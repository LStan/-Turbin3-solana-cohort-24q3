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

    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw_treasury(amount)
    }

    // pub fn update_fee_bps(ctx: Context<UpdateFeeBps>, fee_bps: u16) -> Result<()> {
    //     ctx.accounts.update_fee_bps(fee_bps)
    // }

    pub fn list(
        ctx: Context<List>,
        seed: u64,
        description: String,
        price: u64,
        message_hash: [u8; 32],
        seller_pk_encrypt: Option<Pubkey>,
    ) -> Result<()> {
        ctx.accounts
            .list(seed, description, price, message_hash, seller_pk_encrypt, &ctx.bumps)
    }

    pub fn delist(_ctx: Context<Delist>) -> Result<()> {
        Ok(())
    }

    pub fn purchase(
        ctx: Context<Purchase>,
        encrypt_key_hash: [u8; 32],
        nonce: [u8; 8],
        buyer_pk_encrypt: Option<Pubkey>,
    ) -> Result<()> {
        ctx.accounts.purchase(encrypt_key_hash, nonce, buyer_pk_encrypt)
    }

    pub fn cancel_purchase(ctx: Context<CancelPurchase>) -> Result<()> {
        ctx.accounts.cancel_purchase()
    }

    pub fn complete_purchase(
        ctx: Context<CompletePurchase>,
        encrypted_message: [u8; 320],
        // zk_proof: &[u8],
        zk_proof: Vec<u8>,
    ) -> Result<()> {
        ctx.accounts
            .complete_purchase(encrypted_message, zk_proof.as_slice())
    }
}
