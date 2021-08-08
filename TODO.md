- [x] Add ft_on_transfer to the main contract (to work with ft_transfer_call) which should register how much a user deposited this would then be used and deducted from when a splitter is run
Working On:
- [ ] Add a way to refund deposits (i.e. refund whatever deposit is left as the last promise). This may require keeping a mapping of how much a user deposited. (This may require disabling native sends, but idk, maybe they would then have to specify the amount in the args
	- [ ] Figure out why ft_transfer_call is not working
	- [ ] Have the malloc calls have a "trusted malloc contract" set in their constructor. Then, this is checked when they are called


<!-- Error: handling and reverting -->
- [ ] Have the retrieve funds function (callable by malloc and/or the owner of the funds)


- [ ] Figure out how to get all funds out of that WCall for ref swap
- [x] Have a better setup for testing the WCalls
- [x] Scripts for Rust
- [ ] Basic frontend
- [ ] Disable native and wrapped call txs in the same splitter. Its j plane confusing
