use proc_macro::TokenStream;
use quote::{quote, ToTokens};
use syn::parse::{Nothing, Parser};
use syn::token::{Struct, Token};
use syn::{
    parse_macro_input, parse_quote, DataEnum, DataUnion, DeriveInput, Field, FieldsNamed,
    FieldsUnnamed, ItemStruct,
};

#[proc_macro_attribute]
pub fn malloc_call(args: TokenStream, input: TokenStream) -> TokenStream {
    let _ = parse_macro_input!(args as Nothing);
    let mut input_struct = parse_macro_input!(input as ItemStruct);
    let mut fields = input_struct.fields;
    // syn::Field::parse_named(input)

            // pub whitelisted_malloc_id: nearAccountId
    let bal_field = Field::parse_named
        .parse2(quote! {
            pub balances: malloc_call_core::ft::FungibleTokenBalances
        })
        .unwrap();
    match &mut fields {
        syn::Fields::Named(fields) => fields.named.push(bal_field),
        _ => panic!("Expected named fields"),
    }

    input_struct.fields = fields;
    let (impl_generics, ty_generics, where_clause) = input_struct.generics.split_for_impl();
    let struct_name = &input_struct.ident;

    let stream = quote! {
                use near_sdk::borsh::{self};
                use malloc_call_core::ft::FungibleTokenHandlers;

            #[near_bindgen]
            #[derive(
                near_sdk::borsh::BorshDeserialize, near_sdk::borsh::BorshSerialize, near_sdk::PanicOnDefault,
            )]
            #input_struct
            //    #vis struct #struct_name #ty_generics #where_clause {
            //        #(#fields),*
            //        balances: malloc_call_core::ft::FungibleTokenBalances,
            //     }

                #[near_sdk::near_bindgen]
                impl #impl_generics malloc_call_core::ft::FungibleTokenHandlers for #struct_name #ty_generics #where_clause {
                    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String {
                        self.balances.ft_on_transfer(sender_id, amount, msg)
                    }

                    fn get_ft_balance(&self, account_id: AccountId, token_id: AccountId) -> U128 {
                        self.balances.get_ft_balance(&account_id, &token_id).into()
                    }

                    #[private]
                    fn subtract_ft_balance(&mut self, account_id: AccountId, token_id: AccountId) {
                        self.balances
                            .subtract_contract_bal_from_user(&account_id, token_id);
                    }
                }
            };
    TokenStream::from(stream)
}
