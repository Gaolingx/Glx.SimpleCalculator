//! Per-window calculator sessions.
//!
//! The engine stays in `calc-core`; this module only owns the mapping from a
//! Tauri window label to its `Engine` and the IPC command wrappers.

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};

use calc_core::{CalcCommand, CalcView, Engine, Mode};
use tauri::{State, Window};

#[derive(Default)]
struct WindowSessions {
    active: Option<Mode>,
    engines: HashMap<Mode, Engine>,
}

impl WindowSessions {
    fn engine(&mut self) -> &mut Engine {
        let mode = self.active.unwrap_or(Mode::Basic);
        self.engines
            .entry(mode)
            .or_insert_with(|| Engine::new(mode))
    }
}

#[derive(Default)]
pub struct SessionMap(Mutex<HashMap<String, WindowSessions>>);

impl SessionMap {
    pub fn new() -> Self {
        Self::default()
    }

    /// Activates (and creates on first use) the session for `mode`, matching the
    /// frontend's per-mode view mirror.
    pub fn select(&self, window: &str, mode: Mode) -> CalcView {
        let mut sessions = self.lock();
        let session = sessions.entry(window.to_owned()).or_default();
        session.active = Some(mode);
        session
            .engines
            .entry(mode)
            .or_insert_with(|| Engine::new(mode))
            .view()
    }

    pub fn apply(&self, window: &str, command: CalcCommand) -> CalcView {
        let mut sessions = self.lock();
        sessions
            .entry(window.to_owned())
            .or_default()
            .engine()
            .apply(command)
    }

    pub fn reset(&self, window: &str, mode: Mode) -> CalcView {
        let mut sessions = self.lock();
        let session = sessions.entry(window.to_owned()).or_default();
        session.active = Some(mode);
        let engine = session
            .engines
            .entry(mode)
            .or_insert_with(|| Engine::new(mode));
        *engine = Engine::new(mode);
        engine.view()
    }

    pub fn remove(&self, window: &str) {
        self.lock().remove(window);
    }

    fn lock(&self) -> MutexGuard<'_, HashMap<String, WindowSessions>> {
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
pub fn session_select(
    state: State<'_, SessionMap>,
    window: Window,
    mode: Mode,
) -> Result<CalcView, calc_core::ErrorInfo> {
    Ok(state.select(window.label(), mode))
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
    fn each_mode_keeps_its_own_engine() {
        let sessions = SessionMap::new();
        sessions.apply("main", digit(1));
        sessions.apply("main", digit(2));

        assert_eq!(sessions.select("main", Mode::Scientific).value, "");
        sessions.apply("main", digit(5));

        assert_eq!(sessions.select("main", Mode::Basic).value, "12");
        assert_eq!(sessions.select("main", Mode::Scientific).value, "5");
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
