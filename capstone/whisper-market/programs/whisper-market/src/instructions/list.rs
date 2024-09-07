use anchor_lang::prelude::*;

use crate::{Listing, ListingState, Marketplace};

#[derive(Accounts)]
#[instruction(seed: u64, description:String)]
pub struct List<'info> {
    #[account(mut)]
    seller: Signer<'info>,
    marketplace: Account<'info, Marketplace>,
    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE + description.len(),
        seeds = [b"listing", seller.key().as_ref(), marketplace.key().as_ref(), &seed.to_le_bytes()],
        bump
    )]
    listing: Account<'info, Listing>,
    system_program: Program<'info, System>,
}

impl<'info> List<'info> {
    pub fn list(&mut self, seed: u64, description: String, price: u64, message_hash: [u8; 32], bumps: &ListBumps) -> Result<()> {
        self.listing.set_inner(Listing {
            seed,
            bump: bumps.listing,
            seller: self.seller.key(),
            price,
            message_hash,
            encrypt_key_hash: [0; 32],
            buyer: None,
            encrypt_nonce: [0; 8],
            state: ListingState::Listed,
            description,
            encrypted_message: [0; 317],
        });

        Ok(())
    }
}
