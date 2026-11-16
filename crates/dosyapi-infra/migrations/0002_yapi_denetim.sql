-- v0.1.1: müteahhit yetkilisinin TC'si, yapı denetim firmaları, projede YİBF no ve yapı denetim firması.
-- Yayımlanmış göç dosyaları değiştirilmez; her şema değişikliği yeni bir dosyadır.

ALTER TABLE contractors ADD COLUMN owner_tc_enc BLOB;

-- Denetçilerin ad ve TC'leri tek şifreli blob olarak tutulur.
CREATE TABLE inspections (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    people_enc BLOB NOT NULL
);

ALTER TABLE projects ADD COLUMN yibf TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN inspection_id TEXT REFERENCES inspections (id) ON DELETE RESTRICT;
