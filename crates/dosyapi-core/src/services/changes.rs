//! Kayıt değişikliklerinin tek uygulama noktası.
//!
//! Doğrudan düzenleme ve onaylı düzenleme aynı yolu izler: `ChangeGate` değişikliği
//! ya hemen `ChangeApplier` ile uygular ya da onay kuyruğuna yazar. Onaylanan talep
//! de yeniden doğrulanarak aynı uygulayıcıdan geçer.

use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::policy;
use crate::ports::*;
use crate::services::audit::Auditor;
use crate::validate;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Submitted {
    Applied,
    Queued,
}

fn clean_person(
    name: &str,
    tc: &str,
    phone: &str,
    address: &str,
) -> AppResult<(String, String, String, String)> {
    Ok((
        validate::text(name, "Ad", 160)?,
        validate::tax_id(tc)?,
        validate::phone(phone)?,
        validate::text(address, "Adres", 300)?,
    ))
}

fn as_map<T: Serialize>(value: &T) -> AppResult<Map<String, Value>> {
    match serde_json::to_value(value).map_err(AppError::internal)? {
        Value::Object(map) => Ok(map),
        _ => Err(AppError::internal("nesne bekleniyordu")),
    }
}

fn fingerprint(map: &Map<String, Value>, fields: &[String]) -> AppResult<String> {
    let mut hash = Sha256::new();
    for field in fields {
        hash.update(field.as_bytes());
        hash.update(serde_json::to_vec(&map.get(field)).map_err(AppError::internal)?);
    }
    Ok(hash.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// İki kayıt arasındaki farkı çıkarır; talepte tam kopya değil, yalnızca bu alanlar uygulanır.
pub fn diff<T: Serialize>(current: &T, next: &T) -> AppResult<FieldPatch> {
    let (old, new) = (as_map(current)?, as_map(next)?);
    let fields: Vec<String> = new
        .iter()
        .filter(|(k, v)| old.get(*k) != Some(*v))
        .map(|(k, _)| k.clone())
        .collect();
    let base = fingerprint(&old, &fields)?;
    Ok(FieldPatch { fields, base })
}

/// Değişen alanları güncel kayda uygular. Alanlar talepten sonra değiştiyse durur;
/// başka kimsenin yaptığı değişiklik sessizce ezilmez.
pub fn merge<T: Serialize + DeserializeOwned>(
    current: &T,
    next: &T,
    patch: &FieldPatch,
) -> AppResult<T> {
    let mut merged = as_map(current)?;
    if fingerprint(&merged, &patch.fields)? != patch.base {
        return Err(AppError::conflict(
            "Kayıt, talep açıldıktan sonra değişmiş. Talebi reddedip yeniden gönderin.",
        ));
    }
    let new = as_map(next)?;
    for field in &patch.fields {
        if let Some(value) = new.get(field) {
            merged.insert(field.clone(), value.clone());
        }
    }
    serde_json::from_value(Value::Object(merged)).map_err(AppError::internal)
}

/// Onay bekleyen düzenleme ya da silme talebi olan kayıt kilitlidir.
pub async fn ensure_unlocked(pendings: &dyn PendingRepo, id: &str) -> AppResult<()> {
    use PendingPayload::*;
    let locked = pendings
        .list()
        .await?
        .into_iter()
        .any(|p| match &p.payload {
            ProjectUpdate { id: target, .. }
            | ProjectDelete { id: target }
            | AuthorUpdate { id: target, .. }
            | AuthorDelete { id: target }
            | ContractorUpdate { id: target, .. }
            | ContractorDelete { id: target } => target == id,
            _ => false,
        });
    if locked {
        return Err(AppError::conflict(
            "Bu kayıtta onay bekleyen bir talep var.",
        ));
    }
    Ok(())
}

/// Onay ekranında gösterilecek okunur alan adları.
pub fn field_labels(fields: &[String]) -> String {
    let label = |field: &String| match field.as_str() {
        "name" => "Ad",
        "contractorId" => "Müteahhit",
        "ada" => "Ada",
        "parsel" => "Parsel",
        "pafta" => "Pafta",
        "mahalle" => "Mahalle",
        "street" => "Cadde / sokak",
        "status" => "Durum",
        "note" => "Not",
        "owners" => "Arsa sahipleri",
        "proxy" => "Vekil",
        "tc" => "TC",
        "first" | "last" => "Ad soyad",
        "phone" => "Telefon",
        "company" => "Şirket",
        "job" => "Meslek",
        "sicil" => "Sicil",
        "address" => "Adres",
        "title" => "Unvan",
        "owner" => "Yetkili",
        "licence" => "Yetki belgesi",
        "rank" => "Sınıf",
        _ => "Diğer",
    };
    let mut names: Vec<&str> = fields.iter().map(label).collect();
    names.dedup();
    names.join(", ")
}

fn author_from(id: &str, input: AuthorInput) -> Author {
    Author {
        id: id.to_string(),
        tc: input.tc,
        first: input.first,
        last: input.last,
        phone: input.phone,
        company: input.company,
        job: input.job,
        sicil: input.sicil,
        address: input.address,
    }
}

fn contractor_from(id: &str, input: ContractorInput) -> Contractor {
    Contractor {
        id: id.to_string(),
        title: input.title,
        owner: input.owner,
        licence: input.licence,
        rank: input.rank,
        address: input.address,
    }
}

/// Proje fotoğrafının şifreli depodaki anahtarı.
pub fn photo_key(project_id: &str) -> String {
    format!("photo-{project_id}")
}

const MAX_SHARE_DENOMINATOR: u128 = 1_000_000_000_000;

fn parse_share(text: &str) -> Option<(u128, u128)> {
    let compact: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    let (p, q) = compact.split_once('/').unwrap_or((compact.as_str(), "1"));
    let p: u128 = p.parse().ok()?;
    let q: u128 = q.parse().ok()?;
    (p > 0 && q > 0 && p <= q && q <= MAX_SHARE_DENOMINATOR).then_some((p, q))
}

fn gcd(mut a: u128, mut b: u128) -> u128 {
    while b != 0 {
        (a, b) = (b, a % b);
    }
    a
}

/// Tapudaki hisseler kesirdir ve toplamı tam olarak 1/1 olmalıdır.
/// Tek arsa sahibinin hissesi boşsa 1/1 sayılır. Hisseler boşluksuz `pay/payda` olarak saklanır.
pub fn check_shares(owners: &mut [Owner]) -> AppResult<()> {
    if owners.is_empty() {
        return Ok(());
    }
    if let [only] = owners
        && only.share.trim().is_empty()
    {
        only.share = "1/1".into();
    }
    let too_big = || AppError::validation("Hisse paydaları hesaplanamayacak kadar büyük.");
    let (mut num, mut den) = (0u128, 1u128);
    for owner in owners.iter_mut() {
        if owner.share.trim().is_empty() {
            return Err(AppError::validation(format!(
                "{} için hisse girin (ör. 1/2).",
                owner.name
            )));
        }
        let (p, q) = parse_share(&owner.share).ok_or_else(|| {
            AppError::validation(format!(
                "“{}” geçerli bir hisse değil; 1/2 gibi bir kesir yazın.",
                owner.share
            ))
        })?;
        owner.share = format!("{p}/{q}");
        let next_num = num
            .checked_mul(q)
            .and_then(|a| p.checked_mul(den).and_then(|b| a.checked_add(b)))
            .ok_or_else(too_big)?;
        let next_den = den.checked_mul(q).ok_or_else(too_big)?;
        let g = gcd(next_num, next_den);
        (num, den) = (next_num / g, next_den / g);
    }
    if (num, den) != (1, 1) {
        return Err(AppError::validation(format!(
            "Hisselerin toplamı 1/1 olmalı; şu an {num}/{den}."
        )));
    }
    Ok(())
}

pub fn normalize_project(input: &ProjectInput) -> AppResult<ProjectInput> {
    if input.owners.len() > 100 {
        return Err(AppError::validation(
            "En fazla 100 arsa sahibi eklenebilir.",
        ));
    }
    let mut owners = Vec::with_capacity(input.owners.len());
    for owner in &input.owners {
        let (name, tc, phone, address) =
            clean_person(&owner.name, &owner.tc, &owner.phone, &owner.address)?;
        owners.push(Owner {
            id: if owner.id.is_empty() {
                new_id()
            } else {
                validate::text(&owner.id, "Kimlik", 64)?
            },
            name,
            tc,
            phone,
            address,
            share: validate::text(&owner.share, "Hisse", 32)?,
        });
    }
    let (name, tc, phone, address) = clean_person(
        &input.proxy.name,
        &input.proxy.tc,
        &input.proxy.phone,
        &input.proxy.address,
    )?;
    Ok(ProjectInput {
        name: validate::required(&input.name, "İnşaat adı", 200)?,
        contractor_id: validate::uuid(&input.contractor_id)
            .map_err(|_| AppError::validation("Müteahhit seçin."))?,
        ada: validate::required(&input.ada, "Ada no", 32)?,
        parsel: validate::required(&input.parsel, "Parsel no", 32)?,
        pafta: validate::text(&input.pafta, "Pafta", 32)?,
        mahalle: validate::required(&input.mahalle, "Mahalle", 160)?,
        street: validate::required(&input.street, "Cadde / sokak", 200)?,
        status: input.status,
        note: validate::multiline(&input.note, "Not", 4000)?,
        owners,
        proxy: Proxy {
            name,
            tc,
            phone,
            address,
        },
    })
}

pub fn normalize_author(input: &AuthorInput) -> AppResult<AuthorInput> {
    Ok(AuthorInput {
        tc: validate::tax_id(&input.tc)?,
        first: validate::required(&input.first, "İsim", 100)?,
        last: validate::text(&input.last, "Soyisim", 100)?,
        phone: validate::phone(&input.phone)?,
        company: validate::text(&input.company, "Şirket", 200)?,
        job: validate::required(&input.job, "Meslek", 100)?,
        sicil: validate::text(&input.sicil, "Sicil", 64)?,
        address: validate::text(&input.address, "Adres", 300)?,
    })
}

pub fn normalize_contractor(input: &ContractorInput) -> AppResult<ContractorInput> {
    Ok(ContractorInput {
        title: validate::required(&input.title, "Firma unvanı", 200)?,
        owner: validate::text(&input.owner, "Yetkili", 160)?,
        licence: validate::text(&input.licence, "Yetki belge no", 64)?,
        rank: validate::text(&input.rank, "Sınıf", 16)?,
        address: validate::text(&input.address, "Adres", 300)?,
    })
}

#[derive(Clone)]
pub struct ChangeApplier {
    pub projects: Arc<dyn ProjectRepo>,
    pub authors: Arc<dyn AuthorRepo>,
    pub contractors: Arc<dyn ContractorRepo>,
    pub files: Arc<dyn FileRepo>,
    pub store: Arc<dyn FileStore>,
    pub clock: Arc<dyn Clock>,
}

impl ChangeApplier {
    fn build_project(
        id: &str,
        input: ProjectInput,
        existing: Option<&Project>,
        title: String,
        now: Timestamp,
    ) -> Project {
        Project {
            id: id.to_string(),
            name: input.name,
            contractor_id: input.contractor_id,
            contractor: title,
            ada: input.ada,
            parsel: input.parsel,
            pafta: input.pafta,
            mahalle: input.mahalle,
            street: input.street,
            status: input.status,
            done: input.status.is_done(),
            note: input.note,
            photo_at: existing.map_or(0, |p| p.photo_at),
            photo_mime: existing.map(|p| p.photo_mime.clone()).unwrap_or_default(),
            author_ids: existing.map(|p| p.author_ids.clone()).unwrap_or_default(),
            owners: input.owners,
            proxy: input.proxy,
            created_at: existing.map_or(now, |p| p.created_at),
            updated_at: now,
        }
    }

    async fn contractor_title(&self, id: &str) -> AppResult<String> {
        match self.contractors.get(id).await? {
            Some(contractor) => Ok(contractor.title),
            None => Err(AppError::validation("Seçilen müteahhit bulunamadı.")),
        }
    }

    async fn remove_file(&self, file: &StoredFile) -> AppResult<()> {
        self.files.delete(&file.id).await?;
        self.store.delete(&file.id).await
    }

    async fn delete_project(&self, id: &str) -> AppResult<()> {
        for file in self.files.in_project(id).await? {
            self.store.delete(&file.id).await?;
        }
        self.store.delete(&photo_key(id)).await?;
        self.projects.delete(id).await
    }

    async fn assign_author(&self, id: &str, job: &str, author_id: &str) -> AppResult<()> {
        let project = self.projects.get(id).await?.ok_or(AppError::NotFound)?;
        let authors = self.authors.list().await?;
        if !author_id.is_empty() {
            let chosen = authors
                .iter()
                .find(|a| a.id == author_id)
                .ok_or(AppError::NotFound)?;
            if chosen.job != job {
                return Err(AppError::validation(
                    "Müellifin mesleği bu satırla uyuşmuyor.",
                ));
            }
        }
        let mut ids: Vec<Id> = project
            .author_ids
            .into_iter()
            .filter(|existing| {
                authors
                    .iter()
                    .find(|a| &a.id == existing)
                    .is_none_or(|a| a.job != job)
            })
            .collect();
        if !author_id.is_empty() {
            ids.push(author_id.to_string());
        }
        self.projects.set_authors(id, &ids).await
    }

    pub async fn apply(&self, payload: &PendingPayload) -> AppResult<()> {
        use PendingPayload::*;
        match payload {
            ProjectCreate { id, input } => {
                let mut input = normalize_project(input)?;
                check_shares(&mut input.owners)?;
                let title = self.contractor_title(&input.contractor_id).await?;
                let project = Self::build_project(id, input, None, title, self.clock.now());
                self.projects.insert(&project).await
            }
            ProjectUpdate { id, input, patch } => {
                let current = self.projects.get(id).await?.ok_or(AppError::NotFound)?;
                let mut merged = merge(&current.input(), &normalize_project(input)?, patch)?;
                if patch.fields.iter().any(|f| f == "owners") {
                    check_shares(&mut merged.owners)?;
                }
                let title = self.contractor_title(&merged.contractor_id).await?;
                let now = self.clock.now();
                let project = Self::build_project(id, merged, Some(&current), title, now);
                self.projects.update(&project).await
            }
            ProjectDelete { id } => self.delete_project(id).await,
            AuthorCreate { id, input } => {
                self.authors
                    .insert(&author_from(id, normalize_author(input)?))
                    .await
            }
            AuthorUpdate { id, input, patch } => {
                let current = self.authors.get(id).await?.ok_or(AppError::NotFound)?;
                let merged = merge(&current.input(), &normalize_author(input)?, patch)?;
                self.authors.update(&author_from(id, merged)).await
            }
            AuthorDelete { id } => self.authors.delete(id).await,
            ContractorCreate { id, input } => {
                self.contractors
                    .insert(&contractor_from(id, normalize_contractor(input)?))
                    .await
            }
            ContractorUpdate { id, input, patch } => {
                let current = self.contractors.get(id).await?.ok_or(AppError::NotFound)?;
                let merged = merge(&current.input(), &normalize_contractor(input)?, patch)?;
                self.contractors.update(&contractor_from(id, merged)).await
            }
            ContractorDelete { id } => {
                self.contractors.get(id).await?.ok_or(AppError::NotFound)?;
                if self.projects.uses_contractor(id).await? {
                    return Err(AppError::conflict(
                        "Bu müteahhit projelerde kullanılıyor; önce projelerden kaldırın.",
                    ));
                }
                self.contractors.delete(id).await
            }
            FileAdd {
                file_id, replace, ..
            } => {
                let file = self.files.get(file_id).await?.ok_or(AppError::NotFound)?;
                if *replace && let Some(slot) = &file.doc_type_id {
                    for old in self.files.in_doc_slot(&file.project_id, slot).await? {
                        if old.id != file.id && old.state == FileState::Active {
                            self.remove_file(&old).await?;
                        }
                    }
                }
                self.files.set_state(file_id, FileState::Active).await
            }
            FileRemove { file_id, .. } => {
                let file = self.files.get(file_id).await?.ok_or(AppError::NotFound)?;
                self.remove_file(&file).await
            }
            ProjectAuthor { id, job, author_id } => self.assign_author(id, job, author_id).await,
            UserApprove { .. } | UserDelete { .. } => Err(AppError::internal(
                "kullanıcı talepleri ApprovalService içinde işlenir",
            )),
        }
    }
}

pub struct Change {
    pub kind: PendingKind,
    pub entity: Entity,
    pub payload: PendingPayload,
    pub title: String,
    pub detail: String,
    pub doc_key: Option<Id>,
    pub file_name: Option<String>,
}

#[derive(Clone)]
pub struct ChangeGate {
    pub applier: ChangeApplier,
    pub pendings: Arc<dyn PendingRepo>,
    pub clock: Arc<dyn Clock>,
    pub audit: Auditor,
}

impl ChangeGate {
    /// Yazma yetkisini doğrular; doğrudan modda uygular, onaylı modda kuyruğa alır.
    pub async fn submit(
        &self,
        actor: &Actor,
        mode: AccessMode,
        change: Change,
    ) -> AppResult<Submitted> {
        if !mode.can_write() {
            return Err(AppError::Forbidden);
        }
        let action = format!("{}.{}", change.entity.as_str(), change.kind.as_str());
        if mode.is_direct() {
            self.applier.apply(&change.payload).await?;
            self.audit
                .user(actor, &action, &change.title, "applied")
                .await?;
            return Ok(Submitted::Applied);
        }
        self.pendings
            .insert(&Pending {
                id: new_id(),
                kind: change.kind,
                entity: change.entity,
                payload: change.payload,
                title: change.title.clone(),
                detail: change.detail,
                by: actor.name.clone(),
                by_id: actor.user_id.clone(),
                when: self.clock.now(),
                min_level: policy::approver_level(actor),
                target_level: None,
                doc_key: change.doc_key,
                file_name: change.file_name,
            })
            .await?;
        self.audit
            .user(actor, &action, &change.title, "queued")
            .await?;
        Ok(Submitted::Queued)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn contractor(title: &str, owner: &str) -> ContractorInput {
        ContractorInput {
            title: title.into(),
            owner: owner.into(),
            licence: "1".into(),
            rank: "B".into(),
            address: "X".into(),
        }
    }

    #[test]
    fn only_changed_fields_are_applied() {
        let base = contractor("Eski", "Ali");
        let edit = contractor("Yeni", "Ali");
        let patch = diff(&base, &edit).unwrap();
        assert_eq!(patch.fields, vec!["title".to_string()]);
        // Talepten sonra başka bir alan değişti: korunmalı, ezilmemeli.
        let later = contractor("Eski", "Veli");
        let merged = merge(&later, &edit, &patch).unwrap();
        assert_eq!(
            (merged.title.as_str(), merged.owner.as_str()),
            ("Yeni", "Veli")
        );
    }

    #[test]
    fn same_field_changed_meanwhile_is_a_conflict() {
        let base = contractor("Eski", "Ali");
        let edit = contractor("Yeni", "Ali");
        let patch = diff(&base, &edit).unwrap();
        let later = contractor("Baska", "Ali");
        assert!(matches!(
            merge(&later, &edit, &patch),
            Err(AppError::Conflict(_))
        ));
    }

    #[test]
    fn labels_are_readable() {
        let fields = ["first".to_string(), "last".to_string(), "phone".to_string()];
        assert_eq!(field_labels(&fields), "Ad soyad, Telefon");
    }

    fn owners(shares: &[&str]) -> Vec<Owner> {
        shares
            .iter()
            .enumerate()
            .map(|(i, share)| Owner {
                name: format!("Sahip {i}"),
                share: (*share).into(),
                ..Owner::default()
            })
            .collect()
    }

    #[test]
    fn shares_must_add_up_to_whole() {
        let mut list = owners(&["1/2", " 1 / 4 ", "2/8"]);
        check_shares(&mut list).unwrap();
        assert_eq!(
            list[1].share, "1/4",
            "boşluklar atılır, kesir sadeleştirilmez"
        );
        assert!(
            check_shares(&mut owners(&[])).is_ok(),
            "arsa sahibi yoksa denetim yok"
        );
        assert!(check_shares(&mut owners(&["120/480", "360/480"])).is_ok());
        assert!(check_shares(&mut owners(&["1"])).is_ok());

        let mut single = owners(&[""]);
        check_shares(&mut single).unwrap();
        assert_eq!(single[0].share, "1/1", "tek sahibin boş hissesi tamdır");

        let short = check_shares(&mut owners(&["1/2", "1/4"])).unwrap_err();
        assert!(short.to_string().contains("3/4"), "{short}");
        let over = check_shares(&mut owners(&["1/2", "2/3"])).unwrap_err();
        assert!(over.to_string().contains("7/6"), "{over}");
        for bad in [
            "",
            "0/1",
            "3/2",
            "1/0",
            "a/b",
            "-1/2",
            "1/2/3",
            "0.5",
            "1/2000000000000",
        ] {
            let mut list = owners(&[bad, "1/2"]);
            assert!(check_shares(&mut list).is_err(), "{bad:?} reddedilmeli");
        }
        let huge: Vec<String> = (0..40)
            .map(|i| format!("1/{}", 999_999_999_989u128 - i))
            .collect();
        let refs: Vec<&str> = huge.iter().map(String::as_str).collect();
        assert!(
            check_shares(&mut owners(&refs)).is_err(),
            "taşma panik değil hata vermeli"
        );
    }
}
