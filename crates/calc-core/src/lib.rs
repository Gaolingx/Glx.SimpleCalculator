//! Pure calculation core for Glx.SimpleCalculator.
//!
//! Boundary rules (see `PLAN/TODO/01-Addfeatures/HANDOFF.md` §3.10):
//! - no Tauri, no I/O, no network, no user-facing text;
//! - canonical raw values only; display formatting lives in the frontend;
//! - errors cross the IPC boundary as `{ code, args }`.
//!
//! Planned modules (introduced by later tasks):
//! - `value`, `parser`, `engine` (basic session)
//! - `ops::{basic, scientific, programmer, statistics}`
//! - `units` (+ currency conversion over a supplied rate table)
//! - `date`, `worksheet`

pub mod command;
pub mod error;
pub mod mode;
pub mod view;

pub use command::{BinaryOp, CalcCommand, ConstantId, MemoryOp, UnaryOp};
pub use error::{CalcResult, ErrorCode, ErrorInfo};
pub use mode::{AngleUnit, Mode, Radix, WordSize};
pub use view::{CalcView, ProgrammerView};
