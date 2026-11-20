//! Session-scoped multi-slot memory.
//!
//! Entries are kept newest-first. `id` is opaque to the UI and only used to
//! target recall/add/remove; `None` always means "clear all" (for `Clear`) or
//! "the newest slot" (for the other operations).

#[derive(Debug, Clone, PartialEq)]
pub struct MemoryEntry<T> {
    pub id: u64,
    pub value: T,
}

#[derive(Debug, Clone)]
pub struct MemoryStore<T> {
    entries: Vec<MemoryEntry<T>>,
    next_id: u64,
}

impl<T> Default for MemoryStore<T> {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
            next_id: 1,
        }
    }
}

impl<T> MemoryStore<T> {
    pub fn entries(&self) -> &[MemoryEntry<T>] {
        &self.entries
    }

    pub fn store(&mut self, value: T) -> u64 {
        let id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1);
        self.entries.insert(0, MemoryEntry { id, value });
        id
    }

    /// Resolves an explicit id or the newest slot to a list index.
    pub fn index_of(&self, id: Option<u64>) -> Option<usize> {
        match id {
            Some(id) => self.entries.iter().position(|entry| entry.id == id),
            None => (!self.entries.is_empty()).then_some(0),
        }
    }

    pub fn value(&self, index: usize) -> &T {
        &self.entries[index].value
    }

    pub fn value_mut(&mut self, index: usize) -> &mut T {
        &mut self.entries[index].value
    }

    /// `None` clears every slot; `Some(id)` removes a single slot.
    pub fn remove(&mut self, id: Option<u64>) {
        match id {
            Some(id) => self.entries.retain(|entry| entry.id != id),
            None => self.entries.clear(),
        }
    }

    pub fn values_mut(&mut self) -> impl Iterator<Item = &mut T> {
        self.entries.iter_mut().map(|entry| &mut entry.value)
    }
}
