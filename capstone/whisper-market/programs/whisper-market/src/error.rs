use anchor_lang::prelude::*;

#[error_code]
pub enum MarketPlaceError {
    #[msg("Name must be between 1 and 32 characters long")]
    NameTooLong,
    #[msg("Invalid seller")]
    InvalidSeller,
    #[msg("Item already purchased")]
    AlreadyPurchased,
    #[msg("Cannot cancel the purchase")]
    NotPurchased,
    #[msg("Invalid buyer")]
    InvalidBuyer,
    #[msg("Invalid proof")]
    InvalidProof
}
