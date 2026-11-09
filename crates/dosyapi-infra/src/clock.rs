use dosyapi_core::model::Timestamp;
use dosyapi_core::ports::Clock;

pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> Timestamp {
        time::OffsetDateTime::now_utc().unix_timestamp()
    }
}
