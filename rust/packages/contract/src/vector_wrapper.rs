use core::fmt;
use std::{fmt::Debug, marker::PhantomData};

use near_sdk::{
    borsh::{self, BorshDeserialize, BorshSerialize},
    collections::Vector,
    env::{self, random_seed, used_gas},
    log,
    serde::{
        self,
        de::{value::BoolDeserializer, SeqAccess, Visitor},
        ser::SerializeSeq,
        Deserialize, Deserializer, Serialize,
    },
    serde_json, BorshIntoStorageKey, IntoStorageKey,
};

#[derive(BorshDeserialize, BorshSerialize)]
pub struct VectorWrapper<T>(pub Vector<T>);

fn get_random_bytes_prefix() -> Vec<u8> {
    let mut unique_prefix = env::random_seed();
    unique_prefix.append(&mut used_gas().to_be_bytes().to_vec());
    unique_prefix
}

impl<T: BorshSerialize> VectorWrapper<T> {
    pub fn new<S: IntoStorageKey>(prefix: S) -> Self {
        VectorWrapper(Vector::new(prefix))
    }

    pub fn from_vec<S: IntoStorageKey>(v: Vec<T>, prefix: S) -> Self {
        let mut vector = Vector::new(prefix);
        v.iter().for_each(|i| vector.push(i));
        VectorWrapper(vector)
    }
}

pub struct VectorWrapperVisitor<T> {
    marker: PhantomData<fn() -> VectorWrapper<T>>,
}

impl<T> Serialize for VectorWrapper<T>
where
    T: Serialize + BorshDeserialize + BorshSerialize,
{
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: near_sdk::serde::Serializer,
    {
        let mut seq = serializer.serialize_seq(Some(self.0.len() as usize))?;
        for i in 0..self.0.len() {
            seq.serialize_element(&self.0.get(i).unwrap())?;
        }
        seq.end()
    }
}

impl<T> VectorWrapperVisitor<T> {
    fn new() -> Self {
        VectorWrapperVisitor {
            marker: PhantomData,
        }
    }
}

impl<'de, T> Visitor<'de> for VectorWrapperVisitor<T>
where
    T: Deserialize<'de> + BorshDeserialize + BorshSerialize + Serialize,
{
    // The type that our Visitor is going to produce.
    type Value = VectorWrapper<T>;

    // Format a message stating what data this Visitor expects to receive.
    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("an array")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: near_sdk::serde::de::SeqAccess<'de>,
    {
        let rand_prefix = get_random_bytes_prefix();
        let mut ret_seq: VectorWrapper<T> = VectorWrapper(Vector::new(rand_prefix.as_slice()));
        while let Some(v) = seq.next_element()? {
            ret_seq.0.push(&v);
        }
        Ok(ret_seq)
    }
}

impl<'de, T: Deserialize<'de> + BorshDeserialize + BorshSerialize + Serialize> Deserialize<'de>
    for VectorWrapper<T>
where
    T: BorshSerialize,
{
    fn deserialize<D>(deserializer: D) -> Result<VectorWrapper<T>, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_seq(VectorWrapperVisitor::new())
    }
}

impl<T: PartialEq + BorshDeserialize> PartialEq for VectorWrapper<T> {
    fn eq(&self, other: &Self) -> bool {
        let vec1 = &self.0;
        let vec2 = &other.0;
        if vec1.len() != vec2.len() {
            return false;
        }
        for i in 0..vec1.len() {
            let elem_eq = vec1.get(i).unwrap().eq(&vec2.get(i).unwrap());
            if !elem_eq {
                return false;
            }
        }
        true
    }

    fn ne(&self, other: &Self) -> bool {
        let vec1 = &self.0;
        let vec2 = &other.0;
        if vec1.len() != vec2.len() {
            return false;
        }
        for i in 0..vec1.len() {
            let elem_ne = vec1.get(i).unwrap().ne(&vec2.get(i).unwrap());
            if elem_ne {
                return true;
            }
        }
        false
    }
}

impl<T: BorshDeserialize + Debug> Debug for VectorWrapper<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.0.to_vec().iter()).finish()
    }
}

impl<T: Clone + BorshDeserialize + BorshSerialize> Clone for VectorWrapper<T> {
    fn clone(&self) -> Self {
        let v = &self.0;
        let mut ret: Vector<T> = Vector::new(get_random_bytes_prefix().as_slice());

        for i in 0..v.len() {
            ret.push(&v.get(i).unwrap());
        }
        VectorWrapper(ret)
    }

    fn clone_from(&mut self, source: &Self) {
        *self = source.clone()
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    const INIT_ACCOUNT_BAL: u128 = 10_000;
    use crate::test_utils::tests::get_context;
    use near_sdk::MockedBlockchain;
    use near_sdk::{
        collections::Vector,
        json_types::ValidAccountId,
        serde_json,
        test_utils::{accounts, VMContextBuilder},
        testing_env,
    };

    use super::VectorWrapper;
    // TODO: should panic type
    #[test]
    fn test_serialize() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let mut v = VectorWrapper::<u64>(Vector::new("asas".as_bytes()));
        v.0.push(&10);
        v.0.push(&11);
        let str = serde_json::to_string(&v).unwrap();
        println!("{}", str);
        assert_eq!(str, "[10,11]");
    }

    #[test]
    fn test_deserialize() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let v: VectorWrapper<u64> = serde_json::from_str("[10, 11]").unwrap();
        assert_eq!(v.0.len(), 2);
        assert_eq!(v.0.get(0).unwrap(), 10);
        assert_eq!(v.0.get(1).unwrap(), 11);
    }

    #[test]
    fn test_eq() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let v1: VectorWrapper<u64> = serde_json::from_str("[10, 11]").unwrap();
        let v2: VectorWrapper<u64> = serde_json::from_str("[10, 11]").unwrap();
        assert!(v1.eq(&v2));

        let v3: VectorWrapper<u64> = serde_json::from_str("[11, 11]").unwrap();
        assert!(!v1.eq(&v3))
    }

    #[test]
    fn test_ne() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let v1: VectorWrapper<u64> = serde_json::from_str("[10, 11]").unwrap();
        let v2: VectorWrapper<u64> = serde_json::from_str("[10, 11]").unwrap();
        assert!(!v1.ne(&v2));

        let v3: VectorWrapper<u64> = serde_json::from_str("[11, 11]").unwrap();
        assert!(v1.ne(&v3))
    }

    #[test]
    fn test_clone() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let v1: VectorWrapper<u64> = serde_json::from_str("[10, 11]").unwrap();
        let v1_again: VectorWrapper<u64> = serde_json::from_str("[10, 11]").unwrap();
        let v2 = v1.clone();
        let mut v3: VectorWrapper<u64> = serde_json::from_str("[12, 11]").unwrap();

        assert_eq!(&v1, &v2);

        assert_ne!(&v1, &v3);
        v3.clone_from(&v1_again);
        assert_eq!(v1, v3);
    }
}
