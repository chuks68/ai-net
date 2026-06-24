//! Stellar testnet end-to-end tests.
//!
//! Gated behind the `RUN_STELLAR_E2E_TESTS=true` environment variable.
//! Requires the `stellar` CLI to be installed and a funded account named
//! `e2e-tester` configured in `~/.config/stellar/` pointing at testnet.
//!
//! Run with:
//!   RUN_STELLAR_E2E_TESTS=true cargo test --test integration -- --nocapture

use std::env;
use std::process::Command;

fn stellar(args: &[&str]) -> std::process::Output {
    Command::new("stellar")
        .args(args)
        .output()
        .expect("stellar CLI must be installed for E2E tests")
}

fn require_e2e() -> bool {
    env::var("RUN_STELLAR_E2E_TESTS")
        .map(|v| v == "true")
        .unwrap_or(false)
}

fn wasm_path() -> String {
    let manifest = env!("CARGO_MANIFEST_DIR");
    format!("{manifest}/target/wasm32v1-none/release/agent_registry.wasm")
}

#[test]
fn e2e_deploy_register_lookup_deregister() {
    if !require_e2e() {
        return;
    }

    // ── deploy ───────────────────────────────────────────────────────────────
    let deploy = stellar(&[
        "contract",
        "deploy",
        "--wasm",
        &wasm_path(),
        "--network",
        "testnet",
        "--source-account",
        "e2e-tester",
    ]);
    assert!(
        deploy.status.success(),
        "deploy failed: {}",
        String::from_utf8_lossy(&deploy.stderr)
    );
    let contract_id = String::from_utf8_lossy(&deploy.stdout).trim().to_string();
    println!("deployed contract: {contract_id}");

    // ── register_agent ───────────────────────────────────────────────────────
    let caller = stellar(&["keys", "address", "e2e-tester"]);
    assert!(caller.status.success());
    let owner_addr = String::from_utf8_lossy(&caller.stdout).trim().to_string();

    let register = stellar(&[
        "contract",
        "invoke",
        "--id",
        &contract_id,
        "--network",
        "testnet",
        "--source-account",
        "e2e-tester",
        "--",
        "register_agent",
        "--record",
        &format!(
            r#"{{"id":"e2e_agent","capability":"test","price_stroops":1000,"endpoint":"https://e2e.example.com","owner":"{owner_addr}"}}"#
        ),
    ]);
    assert!(
        register.status.success(),
        "register_agent failed: {}",
        String::from_utf8_lossy(&register.stderr)
    );

    // ── lookup_agents ────────────────────────────────────────────────────────
    let lookup = stellar(&[
        "contract",
        "invoke",
        "--id",
        &contract_id,
        "--network",
        "testnet",
        "--source-account",
        "e2e-tester",
        "--",
        "lookup_agents",
        "--capability",
        "test",
    ]);
    assert!(
        lookup.status.success(),
        "lookup_agents failed: {}",
        String::from_utf8_lossy(&lookup.stderr)
    );
    let out = String::from_utf8_lossy(&lookup.stdout);
    assert!(
        out.contains("e2e_agent"),
        "expected agent in lookup result, got: {out}"
    );

    // ── update_pricing ───────────────────────────────────────────────────────
    let update = stellar(&[
        "contract",
        "invoke",
        "--id",
        &contract_id,
        "--network",
        "testnet",
        "--source-account",
        "e2e-tester",
        "--",
        "update_pricing",
        "--agent_id",
        "e2e_agent",
        "--new_price",
        "2500",
    ]);
    assert!(
        update.status.success(),
        "update_pricing failed: {}",
        String::from_utf8_lossy(&update.stderr)
    );

    // ── deregister_agent ─────────────────────────────────────────────────────
    let deregister = stellar(&[
        "contract",
        "invoke",
        "--id",
        &contract_id,
        "--network",
        "testnet",
        "--source-account",
        "e2e-tester",
        "--",
        "deregister_agent",
        "--agent_id",
        "e2e_agent",
    ]);
    assert!(
        deregister.status.success(),
        "deregister_agent failed: {}",
        String::from_utf8_lossy(&deregister.stderr)
    );

    // verify empty after deregister
    let lookup2 = stellar(&[
        "contract",
        "invoke",
        "--id",
        &contract_id,
        "--network",
        "testnet",
        "--source-account",
        "e2e-tester",
        "--",
        "lookup_agents",
        "--capability",
        "test",
    ]);
    assert!(lookup2.status.success());
    let out2 = String::from_utf8_lossy(&lookup2.stdout);
    assert!(
        !out2.contains("e2e_agent"),
        "agent should be gone after deregister, got: {out2}"
    );

    println!("E2E test passed for contract {contract_id}");
}
