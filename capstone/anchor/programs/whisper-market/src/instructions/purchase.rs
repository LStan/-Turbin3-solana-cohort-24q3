use anchor_lang::{prelude::*, system_program};

use crate::{error::MarketPlaceError, Listing, ListingState, Marketplace};

#[derive(Accounts)]
pub struct Purchase<'info> {
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

impl<'info> Purchase<'info> {
    pub fn purchase(&mut self, encrypt_key_hash: [u8; 31], nonce: [u8; 8]) -> Result<()> {
        require!(
            self.listing.state == ListingState::Listed,
            MarketPlaceError::AlreadyPurchased
        );

        let fee = self
            .listing
            .price
            .checked_mul(self.marketplace.fee_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let full_price = self.listing.price.checked_add(fee).unwrap();

        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = system_program::Transfer {
            from: self.buyer.to_account_info(),
            to: self.listing.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        system_program::transfer(cpi_ctx, full_price)?;

        self.listing.buyer = Some(self.buyer.key());
        self.listing.encrypt_key_hash = encrypt_key_hash;
        self.listing.encrypt_nonce = nonce;
        self.listing.state = ListingState::Purchased;
        Ok(())
    }
}
