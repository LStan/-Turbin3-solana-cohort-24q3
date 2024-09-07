use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seed: u64,
    pub bump: u8,
    pub seller: Pubkey,
    pub price: u64,
    pub message_hash: [u8; 32],
    pub buyer: Option<Pubkey>,
    pub encrypt_key_hash: [u8; 32],
    // pub encrypt_nonce: u64,
    pub encrypt_nonce: [u8; 8],
    pub state: ListingState,
    #[max_len(0)]
    pub description: String,
    pub encrypted_message: [u8; 318],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ListingState {
    Listed,
    Purchased,
    Completed,
}
