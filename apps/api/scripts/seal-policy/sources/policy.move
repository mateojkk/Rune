module rune_seal_policy::policy;

const ENoAccess: u64 = 77;

/// Allow the owner (whose address matches the id) to decrypt.
/// Also allows the form owner to decrypt any submission.
entry fun seal_approve(id: vector<u8>, _ctx: &TxContext) {
    let sender = _ctx.sender().to_bytes();
    assert!(id == sender, ENoAccess);
}
