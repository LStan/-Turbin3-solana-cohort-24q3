use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::StakeConfig;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + StakeConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, StakeConfig>,
    #[account(
        init,
        payer = admin,
        mint::authority = config,
        mint::decimals = 6,
        seeds = [b"rewards", config.key().as_ref()],
        bump
    )]
    pub rewards_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeConfig<'info> {
    pub fn initialize_config(
        &mut self,
        points_per_stake: u8,
        max_stakes: u8,
        freeze_period: u32,
        bumps: &InitializeConfigBumps,
    ) -> Result<()> {
        self.config.set_inner(StakeConfig {
            points_per_stake,
            max_stakes,
            freeze_period,
            rewards_bump: bumps.rewards_mint,
            bump: bumps.config,
        });
        Ok(())
    }
}
