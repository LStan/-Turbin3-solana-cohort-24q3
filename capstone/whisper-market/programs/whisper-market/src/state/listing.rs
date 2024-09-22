use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub marketplace: Pubkey,
    pub seed: u64,
    pub bump: u8,
    pub seller: Pubkey,
    pub price: u64,
    pub message_hash: [u8; 32],
    pub buyer: Option<Pubkey>,
    pub encrypt_key_hash: [u8; 32],
    pub encrypt_nonce: [u8; 8],
    pub seller_pk_encrypt: Option<Pubkey>,
    pub buyer_pk_encrypt: Option<Pubkey>,
    pub state: ListingState,
    pub encrypted_message: [u8; 320],
    #[max_len(0)]
    pub description: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ListingState {
    Listed,
    Purchased,
    Completed,
}
