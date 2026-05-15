module rune_seal_policy::policy {
    use sui::tx_context::{Self as tx_context, TxContext};
    use sui::bcs;

    const ENoAccess: u64 = 77;

    entry fun seal_approve(id: vector<u8>, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);
        let sender_bytes = bcs::to_bytes(&sender);
        assert!(id == sender_bytes, ENoAccess);
    }
}
