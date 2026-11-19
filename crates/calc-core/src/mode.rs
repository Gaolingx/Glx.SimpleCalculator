use serde::{Deserialize, Serialize};

/// Top-level calculator mode. Also used as the history entry discriminator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Mode {
    Basic,
    Scientific,
    Programmer,
    Statistics,
    DateCalc,
    Converter,
    Worksheets,
}

/// Angle unit for trigonometric functions in scientific mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AngleUnit {
    Deg,
    Rad,
    Grad,
}

/// Integer width for programmer mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WordSize {
    Qword,
    Dword,
    Word,
    Byte,
}

impl WordSize {
    pub const fn bits(self) -> u8 {
        match self {
            Self::Qword => 64,
            Self::Dword => 32,
            Self::Word => 16,
            Self::Byte => 8,
        }
    }

    pub const fn mask(self) -> u64 {
        match self {
            Self::Qword => u64::MAX,
            Self::Dword => u32::MAX as u64,
            Self::Word => u16::MAX as u64,
            Self::Byte => u8::MAX as u64,
        }
    }
}

/// Input radix for programmer mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Radix {
    Binary,
    Octal,
    Decimal,
    Hexadecimal,
}

impl Radix {
    pub const fn base(self) -> u8 {
        match self {
            Self::Binary => 2,
            Self::Octal => 8,
            Self::Decimal => 10,
            Self::Hexadecimal => 16,
        }
    }

    pub const fn prefix(self) -> &'static str {
        match self {
            Self::Binary => "0b",
            Self::Octal => "0o",
            Self::Decimal => "",
            Self::Hexadecimal => "0x",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_size_bits_and_mask_are_consistent() {
        for size in [
            WordSize::Byte,
            WordSize::Word,
            WordSize::Dword,
            WordSize::Qword,
        ] {
            let bits = size.bits();
            let expected = if bits == 64 {
                u64::MAX
            } else {
                (1u64 << bits) - 1
            };
            assert_eq!(size.mask(), expected);
        }
    }

    #[test]
    fn radix_base_matches_variant() {
        assert_eq!(Radix::Binary.base(), 2);
        assert_eq!(Radix::Octal.base(), 8);
        assert_eq!(Radix::Decimal.base(), 10);
        assert_eq!(Radix::Hexadecimal.base(), 16);
    }
}
