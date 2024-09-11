use anchor_lang::prelude::*;

use crate::{error::MarketPlaceError, utils::*, Listing, ListingState, Marketplace};

#[derive(Accounts)]
pub struct CompletePurchase<'info> {
    #[account(mut)]
    seller: Signer<'info>,
    marketplace: Account<'info, Marketplace>,
    #[account(
        mut,
        has_one = seller @ MarketPlaceError::InvalidSeller,
        seeds = [b"listing", listing.seller.key().as_ref(), marketplace.key().as_ref(), &listing.seed.to_le_bytes()],
        bump = listing.bump
    )]
    listing: Account<'info, Listing>,
    #[account(
        mut,
        seeds = [b"treasury", marketplace.key().as_ref()],
        bump = marketplace.treasury_bump
    )]
    treasury: SystemAccount<'info>,
    system_program: Program<'info, System>,
}

impl<'info> CompletePurchase<'info> {
    pub fn complete_purchase(&mut self, encrypted_message: [u8; 320], zk_proof: &[u8]) -> Result<()> {
        require!(
            self.listing.state == ListingState::Purchased,
            MarketPlaceError::NotPurchased
        );
        require!(
            verify_proof(
                zk_proof,
                &self.listing.message_hash,
                &self.listing.encrypt_key_hash,
                &encrypted_message,
                &self.listing.encrypt_nonce,
            ),
            MarketPlaceError::InvalidProof
        );

        self.listing.encrypted_message = encrypted_message;
        self.listing.state = ListingState::Completed;

        self.listing.sub_lamports(self.listing.price)?;
        self.seller.add_lamports(self.listing.price)?;

        let fee = self
            .listing
            .price
            .checked_mul(self.marketplace.fee_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        self.listing.sub_lamports(fee)?;
        self.treasury.add_lamports(fee)?;

        Ok(())
    }
}
