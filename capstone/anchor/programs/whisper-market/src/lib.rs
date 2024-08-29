pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("AL8vd4XrR2xWLjHCsMUQHYnEtYR8BoMYXgySJGGkJSQ4");

#[program]
pub mod whisper_market {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String, fee_bps: u16) -> Result<()> {
        ctx.accounts.init(name, fee_bps, &ctx.bumps)
    }
}
