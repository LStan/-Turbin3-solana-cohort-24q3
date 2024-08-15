use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Maximum stake reached")]
    MaxStake,
    #[msg("Cannot unstake yet")]
    InvalidFreezePeriod,
}
