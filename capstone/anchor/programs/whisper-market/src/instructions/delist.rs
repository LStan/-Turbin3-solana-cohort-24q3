use anchor_lang::prelude::*;

use crate::{Listing, Marketplace};

#[derive(Accounts)]
pub struct Delist<'info> {
    #[account(mut)]
    seller: Signer<'info>,
    #[account(
        seeds = [b"marketplace", marketplace.name.as_bytes()],
        bump = marketplace.bump
    )]
    marketplace: Account<'info, Marketplace>,
    #[account(
        mut,
        close = seller,
        has_one = seller,
    )]
    listing: Account<'info, Listing>,
    system_program: Program<'info, System>,
}
