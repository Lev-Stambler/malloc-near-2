#!/bin/sh
# Ran from wcalls/ref-swap-wcall
# Usage
#./scripts/init.sh <REF FINANCE CONTRACT>

near call $(cat ./neardev/dev-account) new --accountId=levtester.testnet "{\"ref_finance\": \"$1\"}"
# near call $(cat ./neardev/dev-account) new --accountId=levtester.testnet "{\"ref_finance\": \"$1\"}"
