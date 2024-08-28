use anchor_lang::prelude::*;

use crate::{error::MarketPlaceError, Marketplace};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Initialize<'info> {
    #[account(mut)]
    admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Marketplace::INIT_SPACE,
        seeds = [b"marketplace", name.as_bytes()],
        bump
    )]
    marketplace: Account<'info, Marketplace>,
    #[account(
        seeds = [b"treasury", marketplace.key().as_ref()],
        bump
    )]
    treasury: SystemAccount<'info>,
    system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn init(&mut self, name: String, fee_bps: u16, bumps: &InitializeBumps) -> Result<()> {
        require!(
            name.len() >= 1 && name.len() <= 32,
            MarketPlaceError::NameTooLong
        );

        self.marketplace.set_inner(Marketplace {
            admin: self.admin.key(),
            name,
            fee_bps,
            treasury_bump: bumps.treasury,
            bump: bumps.marketplace,
        });

        Ok(())
    }
}

