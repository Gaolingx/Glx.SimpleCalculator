//! Pure calculation core for Glx.SimpleCalculator.
//!
//! Boundary rules (see `PLAN/TODO/01-Addfeatures/HANDOFF.md` §3.10):
//! - no Tauri, no I/O, no network, no user-facing text;
//! - canonical raw values only; display formatting lives in the frontend;
//! - errors cross the IPC boundary as `{ code, args }`.

pub mod command;
pub mod date;
pub mod engine;
pub mod error;
pub mod mode;
pub mod ops;
pub mod parser;
pub mod units;
pub mod value;
pub mod view;

pub use command::{BinaryOp, CalcCommand, ConstantId, MemoryOp, StatOp, UnaryOp};
pub use engine::Engine;
pub use error::{CalcResult, ErrorCode, ErrorInfo};
pub use mode::{AngleUnit, Mode, Radix, WordSize};
pub use units::{RateTable, UnitCategory};
pub use value::Number;
pub use view::{
    CalcView, DateDifference, DateShift, ProgrammerView, StatisticsView, UnitCatalog,
    UnitCategoryInfo, UnitConversion, UnitInfo,
};
