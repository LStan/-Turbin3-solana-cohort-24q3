use anchor_lang::prelude::*;

use crate::{error::MarketPlaceError, Listing, ListingState, Marketplace};

#[derive(Accounts)]
pub struct CancelPurchase<'info> {
    #[account(mut)]
    buyer: Signer<'info>,
    marketplace: Account<'info, Marketplace>,
    #[account(
        mut,
        seeds = [b"listing", listing.seller.key().as_ref(), marketplace.key().as_ref(), &listing.seed.to_le_bytes()],
        bump = listing.bump
    )]
    listing: Account<'info, Listing>,
    system_program: Program<'info, System>,
}

impl<'info> CancelPurchase<'info> {
    pub fn cancel_purchase(&mut self) -> Result<()> {
        require!(
            self.listing.state == ListingState::Purchased,
            MarketPlaceError::NotPurchased
        );
        require!(
            self.listing.buyer == Some(self.buyer.key()),
            MarketPlaceError::InvalidBuyer
        );

        let fee = self
            .listing
            .price
            .checked_mul(self.marketplace.fee_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let full_price = self.listing.price.checked_add(fee).unwrap();

        self.listing.sub_lamports(full_price)?;
        self.buyer.add_lamports(full_price)?;

        self.listing.buyer = None;
        self.listing.encrypt_key_hash = [0; 31];
        self.listing.encrypt_nonce = [0; 8];
        self.listing.state = ListingState::Listed;
        Ok(())
    }
}
