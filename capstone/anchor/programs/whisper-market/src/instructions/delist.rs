use anchor_lang::prelude::*;

use crate::{error::MarketPlaceError, Listing, ListingState};

#[derive(Accounts)]
pub struct Delist<'info> {
    #[account(mut)]
    seller: Signer<'info>,
    #[account(
        mut,
        close = seller,
        has_one = seller @ MarketPlaceError::InvalidSeller,
        constraint = listing.state == ListingState::Listed @ MarketPlaceError::AlreadyPurchased
    )]
    listing: Account<'info, Listing>,
    system_program: Program<'info, System>,
}
