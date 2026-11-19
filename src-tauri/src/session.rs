//! Per-window calculator sessions.
//!
//! The engine stays in `calc-core`; this module only owns the mapping from a
//! Tauri window label to its `Engine` and the IPC command wrappers.

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};

use calc_core::{CalcCommand, CalcView, Engine, Mode};
use tauri::{State, Window};

#[derive(Default)]
pub struct SessionMap(Mutex<HashMap<String, Engine>>);

impl SessionMap {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn apply(&self, window: &str, command: CalcCommand) -> CalcView {
        let mut sessions = self.lock();
        sessions
            .entry(window.to_owned())
            .or_insert_with(|| Engine::new(Mode::Basic))
            .apply(command)
    }

    pub fn reset(&self, window: &str, mode: Mode) -> CalcView {
        let mut sessions = self.lock();
        let engine = sessions
            .entry(window.to_owned())
            .or_insert_with(|| Engine::new(mode));
        *engine = Engine::new(mode);
        engine.view()
    }

    pub fn remove(&self, window: &str) {
        self.lock().remove(window);
    }

    fn lock(&self) -> MutexGuard<'_, HashMap<String, Engine>> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[tauri::command]
pub fn calc_command(
    state: State<'_, SessionMap>,
    window: Window,
    cmd: CalcCommand,
) -> Result<CalcView, calc_core::ErrorInfo> {
    Ok(state.apply(window.label(), cmd))
}

#[tauri::command]
pub fn session_reset(
    state: State<'_, SessionMap>,
    window: Window,
    mode: Mode,
) -> Result<CalcView, calc_core::ErrorInfo> {
    Ok(state.reset(window.label(), mode))
}

#[cfg(test)]
mod tests {
    use super::*;
    use calc_core::BinaryOp;

    fn digit(value: u8) -> CalcCommand {
        CalcCommand::Digit { digit: value }
    }

    #[test]
    fn sessions_are_isolated_per_window() {
        let sessions = SessionMap::new();
        for value in [1, 2, 3] {
            sessions.apply("main", digit(value));
        }
        sessions.apply("secondary", digit(9));

        assert_eq!(sessions.apply("main", digit(4)).value, "1234");
        assert_eq!(sessions.apply("secondary", digit(8)).value, "98");
    }

    #[test]
    fn reset_replaces_the_window_session() {
        let sessions = SessionMap::new();
        sessions.apply("main", digit(5));
        sessions.apply("main", CalcCommand::Binary { op: BinaryOp::Add });

        let view = sessions.reset("main", Mode::Basic);
        assert_eq!(view.value, "");
        assert_eq!(view.expression, "");
        assert_eq!(sessions.apply("main", digit(7)).value, "7");
    }

    #[test]
    fn removed_windows_start_from_an_empty_session() {
        let sessions = SessionMap::new();
        sessions.apply("main", digit(1));
        sessions.remove("main");

        let view = sessions.apply("main", digit(2));
        assert_eq!(view.value, "2");
        assert_eq!(view.expression, "");
    }
}
