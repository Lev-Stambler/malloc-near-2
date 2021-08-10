#![feature(prelude_import)]
#[prelude_import]
use std::prelude::rust_2018::*;
#[macro_use]
extern crate std;
use std::{u64, usize};
use malloc_call_core::malloc_call;
use malloc_call_core::{self};
use malloc_call_core::{utils::new_balances, MallocCallMetadata, MallocCallNoCallback, ReturnItem};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::env::predecessor_account_id;
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, ext_contract, log, near_bindgen, serde, setup_alloc, AccountId, Gas, PanicOnDefault,
    Promise,
};
#[serde(crate = "near_sdk::serde")]
pub struct BlackWholeArgs {
    log_message: String,
}
#[doc(hidden)]
#[allow(non_upper_case_globals, unused_attributes, unused_qualifications)]
const _: () = {
    use near_sdk::serde as _serde;
    #[automatically_derived]
    impl near_sdk::serde::Serialize for BlackWholeArgs {
        fn serialize<__S>(
            &self,
            __serializer: __S,
        ) -> near_sdk::serde::export::Result<__S::Ok, __S::Error>
        where
            __S: near_sdk::serde::Serializer,
        {
            let mut __serde_state = match _serde::Serializer::serialize_struct(
                __serializer,
                "BlackWholeArgs",
                false as usize + 1,
            ) {
                _serde::export::Ok(__val) => __val,
                _serde::export::Err(__err) => {
                    return _serde::export::Err(__err);
                }
            };
            match _serde::ser::SerializeStruct::serialize_field(
                &mut __serde_state,
                "log_message",
                &self.log_message,
            ) {
                _serde::export::Ok(__val) => __val,
                _serde::export::Err(__err) => {
                    return _serde::export::Err(__err);
                }
            };
            _serde::ser::SerializeStruct::end(__serde_state)
        }
    }
};
#[doc(hidden)]
#[allow(non_upper_case_globals, unused_attributes, unused_qualifications)]
const _: () = {
    use near_sdk::serde as _serde;
    #[automatically_derived]
    impl<'de> near_sdk::serde::Deserialize<'de> for BlackWholeArgs {
        fn deserialize<__D>(
            __deserializer: __D,
        ) -> near_sdk::serde::export::Result<Self, __D::Error>
        where
            __D: near_sdk::serde::Deserializer<'de>,
        {
            #[allow(non_camel_case_types)]
            enum __Field {
                __field0,
                __ignore,
            }
            struct __FieldVisitor;
            impl<'de> _serde::de::Visitor<'de> for __FieldVisitor {
                type Value = __Field;
                fn expecting(
                    &self,
                    __formatter: &mut _serde::export::Formatter,
                ) -> _serde::export::fmt::Result {
                    _serde::export::Formatter::write_str(__formatter, "field identifier")
                }
                fn visit_u64<__E>(self, __value: u64) -> _serde::export::Result<Self::Value, __E>
                where
                    __E: _serde::de::Error,
                {
                    match __value {
                        0u64 => _serde::export::Ok(__Field::__field0),
                        _ => _serde::export::Err(_serde::de::Error::invalid_value(
                            _serde::de::Unexpected::Unsigned(__value),
                            &"field index 0 <= i < 1",
                        )),
                    }
                }
                fn visit_str<__E>(self, __value: &str) -> _serde::export::Result<Self::Value, __E>
                where
                    __E: _serde::de::Error,
                {
                    match __value {
                        "log_message" => _serde::export::Ok(__Field::__field0),
                        _ => _serde::export::Ok(__Field::__ignore),
                    }
                }
                fn visit_bytes<__E>(
                    self,
                    __value: &[u8],
                ) -> _serde::export::Result<Self::Value, __E>
                where
                    __E: _serde::de::Error,
                {
                    match __value {
                        b"log_message" => _serde::export::Ok(__Field::__field0),
                        _ => _serde::export::Ok(__Field::__ignore),
                    }
                }
            }
            impl<'de> _serde::Deserialize<'de> for __Field {
                #[inline]
                fn deserialize<__D>(__deserializer: __D) -> _serde::export::Result<Self, __D::Error>
                where
                    __D: _serde::Deserializer<'de>,
                {
                    _serde::Deserializer::deserialize_identifier(__deserializer, __FieldVisitor)
                }
            }
            struct __Visitor<'de> {
                marker: _serde::export::PhantomData<BlackWholeArgs>,
                lifetime: _serde::export::PhantomData<&'de ()>,
            }
            impl<'de> _serde::de::Visitor<'de> for __Visitor<'de> {
                type Value = BlackWholeArgs;
                fn expecting(
                    &self,
                    __formatter: &mut _serde::export::Formatter,
                ) -> _serde::export::fmt::Result {
                    _serde::export::Formatter::write_str(__formatter, "struct BlackWholeArgs")
                }
                #[inline]
                fn visit_seq<__A>(
                    self,
                    mut __seq: __A,
                ) -> _serde::export::Result<Self::Value, __A::Error>
                where
                    __A: _serde::de::SeqAccess<'de>,
                {
                    let __field0 =
                        match match _serde::de::SeqAccess::next_element::<String>(&mut __seq) {
                            _serde::export::Ok(__val) => __val,
                            _serde::export::Err(__err) => {
                                return _serde::export::Err(__err);
                            }
                        } {
                            _serde::export::Some(__value) => __value,
                            _serde::export::None => {
                                return _serde::export::Err(_serde::de::Error::invalid_length(
                                    0usize,
                                    &"struct BlackWholeArgs with 1 element",
                                ));
                            }
                        };
                    _serde::export::Ok(BlackWholeArgs {
                        log_message: __field0,
                    })
                }
                #[inline]
                fn visit_map<__A>(
                    self,
                    mut __map: __A,
                ) -> _serde::export::Result<Self::Value, __A::Error>
                where
                    __A: _serde::de::MapAccess<'de>,
                {
                    let mut __field0: _serde::export::Option<String> = _serde::export::None;
                    while let _serde::export::Some(__key) =
                        match _serde::de::MapAccess::next_key::<__Field>(&mut __map) {
                            _serde::export::Ok(__val) => __val,
                            _serde::export::Err(__err) => {
                                return _serde::export::Err(__err);
                            }
                        }
                    {
                        match __key {
                            __Field::__field0 => {
                                if _serde::export::Option::is_some(&__field0) {
                                    return _serde::export::Err(
                                        <__A::Error as _serde::de::Error>::duplicate_field(
                                            "log_message",
                                        ),
                                    );
                                }
                                __field0 = _serde::export::Some(
                                    match _serde::de::MapAccess::next_value::<String>(&mut __map) {
                                        _serde::export::Ok(__val) => __val,
                                        _serde::export::Err(__err) => {
                                            return _serde::export::Err(__err);
                                        }
                                    },
                                );
                            }
                            _ => {
                                let _ = match _serde::de::MapAccess::next_value::<
                                    _serde::de::IgnoredAny,
                                >(&mut __map)
                                {
                                    _serde::export::Ok(__val) => __val,
                                    _serde::export::Err(__err) => {
                                        return _serde::export::Err(__err);
                                    }
                                };
                            }
                        }
                    }
                    let __field0 = match __field0 {
                        _serde::export::Some(__field0) => __field0,
                        _serde::export::None => {
                            match _serde::private::de::missing_field("log_message") {
                                _serde::export::Ok(__val) => __val,
                                _serde::export::Err(__err) => {
                                    return _serde::export::Err(__err);
                                }
                            }
                        }
                    };
                    _serde::export::Ok(BlackWholeArgs {
                        log_message: __field0,
                    })
                }
            }
            const FIELDS: &'static [&'static str] = &["log_message"];
            _serde::Deserializer::deserialize_struct(
                __deserializer,
                "BlackWholeArgs",
                FIELDS,
                __Visitor {
                    marker: _serde::export::PhantomData::<BlackWholeArgs>,
                    lifetime: _serde::export::PhantomData,
                },
            )
        }
    }
};
use near_sdk;
use near_sdk::borsh::{self};
pub struct Contract {
    balances: malloc_call_core::ft::FungibleTokenBalances,
}
impl borsh::de::BorshDeserialize for Contract
where
    malloc_call_core::ft::FungibleTokenBalances: borsh::BorshDeserialize,
{
    fn deserialize(buf: &mut &[u8]) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
        Ok(Self {
            balances: borsh::BorshDeserialize::deserialize(buf)?,
        })
    }
}
impl borsh::ser::BorshSerialize for Contract
where
    malloc_call_core::ft::FungibleTokenBalances: borsh::ser::BorshSerialize,
{
    fn serialize<W: borsh::maybestd::io::Write>(
        &self,
        writer: &mut W,
    ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
        borsh::BorshSerialize::serialize(&self.balances, writer)?;
        Ok(())
    }
}
impl Default for Contract {
    fn default() -> Self {
        near_sdk::env::panic(b"The contract is not initialized");
    }
}
pub struct ContractContract {
    pub account_id: near_sdk::AccountId,
}
impl ContractContract {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn ft_on_transfer(
        &self,
        sender_id: String,
        amount: String,
        msg: String,
    ) -> near_sdk::PendingContractTx {
        let args = ::serde_json::Value::Object({
            let mut object = ::serde_json::Map::new();
            let _ = object.insert(
                ("sender_id").into(),
                ::serde_json::to_value(&sender_id).unwrap(),
            );
            let _ = object.insert(("amount").into(), ::serde_json::to_value(&amount).unwrap());
            let _ = object.insert(("msg").into(), ::serde_json::to_value(&msg).unwrap());
            object
        })
        .to_string()
        .into_bytes();
        near_sdk::PendingContractTx::new_from_bytes(&self.account_id, "ft_on_transfer", args, false)
    }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn get_ft_balance(
        &self,
        account_id: AccountId,
        token_id: AccountId,
    ) -> near_sdk::PendingContractTx {
        let args = ::serde_json::Value::Object({
            let mut object = ::serde_json::Map::new();
            let _ = object.insert(
                ("account_id").into(),
                ::serde_json::to_value(&account_id).unwrap(),
            );
            let _ = object.insert(
                ("token_id").into(),
                ::serde_json::to_value(&token_id).unwrap(),
            );
            object
        })
        .to_string()
        .into_bytes();
        near_sdk::PendingContractTx::new_from_bytes(&self.account_id, "get_ft_balance", args, true)
    }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn subtract_ft_balance(
        &self,
        account_id: AccountId,
        token_id: AccountId,
    ) -> near_sdk::PendingContractTx {
        let args = ::serde_json::Value::Object({
            let mut object = ::serde_json::Map::new();
            let _ = object.insert(
                ("account_id").into(),
                ::serde_json::to_value(&account_id).unwrap(),
            );
            let _ = object.insert(
                ("token_id").into(),
                ::serde_json::to_value(&token_id).unwrap(),
            );
            object
        })
        .to_string()
        .into_bytes();
        near_sdk::PendingContractTx::new_from_bytes(
            &self.account_id,
            "subtract_ft_balance",
            args,
            false,
        )
    }
}
impl malloc_call_core::ft::FungibleTokenHandlers for Contract {
    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String {
        self.balances.ft_on_transfer(sender_id, amount, msg)
    }
    fn get_ft_balance(&self, account_id: AccountId, token_id: AccountId) -> U128 {
        self.balances.get_ft_balance(&account_id, &token_id).into()
    }
    fn subtract_ft_balance(&mut self, account_id: AccountId, token_id: AccountId) {
        self.balances
            .subtract_contract_bal_from_user(&account_id, token_id);
    }
}
impl ContractContract {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn metadata(&self) -> near_sdk::PendingContractTx {
        let args = ::alloc::vec::Vec::new();
        near_sdk::PendingContractTx::new_from_bytes(&self.account_id, "metadata", args, true)
    }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn malloc_call(
        &self,
        args: BlackWholeArgs,
        amount: String,
        token_id: ValidAccountId,
        caller: ValidAccountId,
    ) -> near_sdk::PendingContractTx {
        let args = ::serde_json::Value::Object({
            let mut object = ::serde_json::Map::new();
            let _ = object.insert(("args").into(), ::serde_json::to_value(&args).unwrap());
            let _ = object.insert(("amount").into(), ::serde_json::to_value(&amount).unwrap());
            let _ = object.insert(
                ("token_id").into(),
                ::serde_json::to_value(&token_id).unwrap(),
            );
            let _ = object.insert(("caller").into(), ::serde_json::to_value(&caller).unwrap());
            object
        })
        .to_string()
        .into_bytes();
        near_sdk::PendingContractTx::new_from_bytes(&self.account_id, "malloc_call", args, false)
    }
}
impl MallocCallNoCallback<BlackWholeArgs> for Contract {
    fn metadata(&self) -> MallocCallMetadata {
        MallocCallMetadata {
            minimum_gas: None,
            minimum_attached_deposit: Some(1.into()),
            name: "Send Fungible Tokens".to_string(),
        }
    }
    fn malloc_call(
        &mut self,
        args: BlackWholeArgs,
        amount: String,
        token_id: ValidAccountId,
        caller: ValidAccountId,
    ) -> Vec<ReturnItem> {
        ::near_sdk::env::log(
            {
                let res = ::alloc::fmt::format(::core::fmt::Arguments::new_v1(
                    &["Log from the blackwhole: "],
                    &match (&args.log_message,) {
                        (arg0,) => [::core::fmt::ArgumentV1::new(
                            arg0,
                            ::core::fmt::Display::fmt,
                        )],
                    },
                ));
                res
            }
            .as_bytes(),
        );
        let caller: AccountId = caller.into();
        let token_id: AccountId = token_id.into();
        let bal = self.balances.get_ft_balance(&caller, &token_id);
        ::near_sdk::env::log(
            {
                let res = ::alloc::fmt::format(::core::fmt::Arguments::new_v1(
                    &[
                        "Caller ",
                        " balance of ",
                        " for contract ",
                        " with amount in of ",
                    ],
                    &match (&caller, &bal, &token_id, &amount) {
                        (arg0, arg1, arg2, arg3) => [
                            ::core::fmt::ArgumentV1::new(arg0, ::core::fmt::Display::fmt),
                            ::core::fmt::ArgumentV1::new(arg1, ::core::fmt::Display::fmt),
                            ::core::fmt::ArgumentV1::new(arg2, ::core::fmt::Display::fmt),
                            ::core::fmt::ArgumentV1::new(arg3, ::core::fmt::Display::fmt),
                        ],
                    },
                ));
                res
            }
            .as_bytes(),
        );
        ::alloc::vec::Vec::new()
    }
}
impl ContractContract {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new(&self) -> near_sdk::PendingContractTx {
        let args = ::alloc::vec::Vec::new();
        near_sdk::PendingContractTx::new_from_bytes(&self.account_id, "new", args, false)
    }
}
impl Contract {
    pub fn new() -> Self {
        Contract {
            balances: new_balances(),
        }
    }
}
