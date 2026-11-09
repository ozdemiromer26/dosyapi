use dosyapi_core::ports::{RateLimiter, RetryAfter};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Bellek içi sabit pencere sınırlayıcı. Tek süreçli dağıtım için yeterlidir;
/// kalıcı kilitler (hesap, master) ayrıca veritabanında tutulur.
#[derive(Default)]
pub struct MemoryRateLimiter {
    buckets: Mutex<HashMap<String, (u32, Instant)>>,
}

impl RateLimiter for MemoryRateLimiter {
    fn hit(&self, key: &str, limit: u32, window_secs: u64) -> Result<(), RetryAfter> {
        let now = Instant::now();
        let mut buckets = self.buckets.lock().unwrap_or_else(|e| e.into_inner());
        if buckets.len() > 50_000 {
            buckets.retain(|_, (_, reset)| *reset > now);
        }
        let entry = buckets
            .entry(key.to_string())
            .or_insert((0, now + Duration::from_secs(window_secs)));
        if entry.1 <= now {
            *entry = (0, now + Duration::from_secs(window_secs));
        }
        entry.0 += 1;
        if entry.0 > limit {
            return Err(RetryAfter(
                entry.1.saturating_duration_since(now).as_secs().max(1),
            ));
        }
        Ok(())
    }

    fn reset(&self, key: &str) {
        self.buckets
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(key);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_after_limit_per_key() {
        let l = MemoryRateLimiter::default();
        assert!(l.hit("a", 2, 60).is_ok());
        assert!(l.hit("a", 2, 60).is_ok());
        assert!(l.hit("a", 2, 60).is_err());
        assert!(l.hit("b", 2, 60).is_ok());
        l.reset("a");
        assert!(l.hit("a", 2, 60).is_ok());
    }
}
