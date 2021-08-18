use proc_macro::TokenStream;
use quote::{quote, ToTokens};
use syn::parse::{Nothing, Parser};
use syn::token::{Struct, Token};
use syn::{
    parse_macro_input, parse_quote, DataEnum, DataUnion, DeriveInput, Field, FieldsNamed,
    FieldsUnnamed, ItemStruct,
};

#[proc_macro_derive(MallocCallFT)]
pub fn malloc_call_ft(input: TokenStream) -> TokenStream {
    let mut input_struct = parse_macro_input!(input as ItemStruct);
    let mut fields = input_struct.fields;

    // // Add the whitelisted malloc contract
    // let malloc_contract_id = Field::parse_named
    //     .parse2(quote! {
    //         pub malloc_contract_id: near_sdk::AccountId
    //     })
    //     .unwrap();
    // match &mut fields {
    //     syn::Fields::Named(fields) => fields.named.push(malloc_contract_id),
    //     _ => panic!("Expected named fields"),
    // }

    // // Add the balances field
    // let bal_field = Field::parse_named
    //     .parse2(quote! {
    //         pub balances: malloc_call_core::ft::FungibleTokenBalances
    //     })
    //     .unwrap();
    // match &mut fields {
    //     syn::Fields::Named(fields) => fields.named.push(bal_field),
    //     _ => panic!("Expected named fields"),
    // }

    // input_struct.fields = fields;
    let (impl_generics, ty_generics, where_clause) = input_struct.generics.split_for_impl();
    let struct_name = &input_struct.ident;

    let stream = quote! {

    //    #vis struct #struct_name #ty_generics #where_clause {
    //        #(#fields),*
    //        balances: malloc_call_core::ft::FungibleTokenBalances,
    //     }

        #[near_sdk::near_bindgen]
        impl #impl_generics malloc_call_core::ft::FungibleTokenHandlers for #struct_name #ty_generics #where_clause {
            fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String {
                self.balances.ft_on_transfer(sender_id, amount, msg)
            }

            fn get_ft_balance(&self, account_id: near_sdk::json_types::ValidAccountId, token_id: near_sdk::json_types::ValidAccountId) -> near_sdk::json_types::U128 {
                self.balances.get_ft_balance(&account_id.into(), &token_id.into()).into()
            }

            fn resolve_internal_ft_transfer_call(&mut self, account_id: near_sdk::json_types::ValidAccountId, token_id: near_sdk::json_types::ValidAccountId, amount: near_sdk::json_types::U128) -> near_sdk::json_types::U128 {
                // This check is the same thing as decorating with #[private], but the macro within a macro causes
                if near_sdk::env::predecessor_account_id() != near_sdk::env::current_account_id() {
                    panic!("Resolve internal ft transfer is a private call");
                }
                self.balances
                    .resolve_internal_ft_transfer_call(&account_id.into(), token_id.into(), amount)
            }

            #[payable]
            fn withdraw_to(
                &mut self,
                account_id: near_sdk::json_types::ValidAccountId,
                amount: near_sdk::json_types::U128,
                token_id: near_sdk::json_types::ValidAccountId,
                recipient: Option<near_sdk::json_types::ValidAccountId>,
                msg: Option<String>,
                transfer_type: malloc_call_core::ft::TransferType) 
            {
                self.balances.withdraw_to(
                    account_id.into(),
                    amount.0,
                    token_id.into(),
                    recipient.map(|v| v.into()),
                    msg,
                    transfer_type,
                    &self.malloc_contract_id
                );
            }
        }
    };
    TokenStream::from(stream)
}
