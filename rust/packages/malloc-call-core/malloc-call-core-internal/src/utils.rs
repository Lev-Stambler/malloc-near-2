use crate::ft::FungibleTokenBalances;

pub fn new_balances() -> FungibleTokenBalances {
    FungibleTokenBalances::new("balances".as_bytes())
}
