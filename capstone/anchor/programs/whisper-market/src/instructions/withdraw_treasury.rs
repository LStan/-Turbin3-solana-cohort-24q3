use anchor_lang::{prelude::*, system_program};

use crate::Marketplace;

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    #[account(mut)]
    admin: Signer<'info>,
    #[account(
        has_one = admin
    )]
    marketplace: Account<'info, Marketplace>,
    #[account(
        mut,
        seeds = [b"treasury", marketplace.key().as_ref()],
        bump = marketplace.treasury_bump
    )]
    treasury: SystemAccount<'info>,
    system_program: Program<'info, System>,
}

impl<'info> WithdrawTreasury<'info> {
    pub fn withdraw_treasury(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = system_program::Transfer {
            from: self.treasury.to_account_info(),
            to: self.admin.to_account_info(),
        };

        let seeds = &[
            b"treasury",
            self.marketplace.to_account_info().key.as_ref(),
            &[self.marketplace.treasury_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        system_program::transfer(cpi_ctx, amount)
    }
}
