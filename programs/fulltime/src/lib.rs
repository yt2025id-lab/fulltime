use anchor_lang::prelude::*;

declare_id!("6zQK3dYwKp5AKVvknkPLvfxKLZJ1PVaVr393vugtVKQc");

// ─── Constants ────────────────────────────────────────────────────
const DISPUTE_WINDOW_SECONDS: i64 = 3600;
const PLATFORM_FEE_BPS: u16 = 200;

/// TxLINE Txoracle Program ID (devnet)
const TXLINE_TXORACLE_ID: Pubkey = pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

/// Discriminator untuk `validate_stat` instruction (IDL txoracle v1.4.2)
const VALIDATE_STAT_DISCRIMINATOR: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];

// ─── State ─────────────────────────────────────────────────────────

#[account]
pub struct Market {
    pub fixture_id: u64,
    pub question: String,          // max 200 chars
    pub creator: Pubkey,
    pub outcome_count: u8,         // 3 (Home/Draw/Away)
    pub total_pool: u64,
    pub pool_home: u64,
    pub pool_draw: u64,
    pub pool_away: u64,
    pub betting_open_time: i64,
    pub betting_close_time: i64,
    pub status: MarketStatus,
    pub winning_option: u8,        // 0=HOME, 1=DRAW, 2=AWAY, 255=unset
    pub settlement_root: Pubkey,
    pub settlement_epoch_day: u16,
    pub settlement_ts: i64,
    pub dispute_until: i64,
    pub fee_bps: u16,
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 8  // discriminator
        + 8   // fixture_id
        + 4 + 200 // question (4-byte len prefix + max 200 chars)
        + 32  // creator
        + 1   // outcome_count
        + 8   // total_pool
        + 8   // pool_home
        + 8   // pool_draw
        + 8   // pool_away
        + 8   // betting_open_time
        + 8   // betting_close_time
        + 1   // status (enum discriminant)
        + 1   // winning_option
        + 32  // settlement_root
        + 2   // settlement_epoch_day
        + 8   // settlement_ts
        + 8   // dispute_until
        + 2   // fee_bps
        + 1;  // bump
}

#[account]
pub struct Bet {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub option_index: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Bet {
    pub const LEN: usize = 8  // discriminator
        + 32  // market
        + 32  // bettor
        + 1   // option_index
        + 8   // amount
        + 1   // claimed
        + 1;  // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum MarketStatus {
    Pending,
    Open,
    Closed,
    Settled,
    Cancelled,
}

// ─── TxLINE CPI Types (matching IDL txoracle v1.4.2) ──────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

// ─── Events ────────────────────────────────────────────────────────

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub fixture_id: u64,
    pub creator: Pubkey,
    pub question: String,
    pub betting_close_time: i64,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub option_index: u8,
    pub amount: u64,
}

#[event]
pub struct MarketSettled {
    pub market: Pubkey,
    pub fixture_id: u64,
    pub winning_option: u8,
    pub home_goals: i32,
    pub away_goals: i32,
    pub settlement_root: Pubkey,
}

#[event]
pub struct PayoutClaimed {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub amount: u64,
}

// ─── Error Codes ───────────────────────────────────────────────────

#[error_code]
pub enum FullTimeError {
    #[msg("Question terlalu panjang (max 200 karakter)")]
    QuestionTooLong,
    #[msg("Betting close time harus di masa depan")]
    BettingCloseTimeInPast,
    #[msg("Betting close time harus setelah open time")]
    InvalidBettingWindow,
    #[msg("Market belum open")]
    MarketNotOpen,
    #[msg("Betting window sudah tutup")]
    BettingClosed,
    #[msg("Option index di luar batas (0=HOME, 1=DRAW, 2=AWAY)")]
    InvalidOptionIndex,
    #[msg("Market belum closed, tidak bisa di-settle")]
    MarketNotClosed,
    #[msg("Market sudah di-settle")]
    MarketAlreadySettled,
    #[msg("Market tidak dalam status yang benar")]
    InvalidMarketStatus,
    #[msg("Belum waktunya klaim — market belum settled atau still disputed")]
    ClaimNotAvailable,
    #[msg("Bet ini sudah diklaim")]
    AlreadyClaimed,
    #[msg("Opsi yang dipilih bukan pemenang")]
    NotWinner,
    #[msg("Hanya creator market yang bisa cancel")]
    UnauthorizedCancel,
    #[msg("Verifikasi Merkle proof gagal — stat tidak valid atau fixture salah")]
    MerkleVerificationFailed,
    #[msg("Stat value tidak valid (harus >= 0)")]
    InvalidStatValue,
    #[msg("Jumlah bet harus > 0")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Daily scores roots PDA tidak dikenali")]
    InvalidDailyScoresRoots,
}

// ─── Contexts ──────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(fixture_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [
            b"market",
            crate::id().as_ref(),
            creator.key().as_ref(),
            &fixture_id.to_le_bytes(),
        ],
        bump,
    )]
    pub market: Account<'info, Market>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = bettor,
        space = Bet::LEN,
        seeds = [
            b"bet",
            market.key().as_ref(),
            bettor.key().as_ref(),
        ],
        bump,
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseBetting<'info> {
    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Akun PDA daily_scores_roots milik TxLINE program —
    /// diverifikasi seed-nya di instruksi, bukan di derive macro
    pub daily_scores_merkle_roots: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [
            b"bet",
            market.key().as_ref(),
            bettor.key().as_ref(),
        ],
        bump = bet.bump,
    )]
    pub bet: Account<'info, Bet>,
}

#[derive(Accounts)]
pub struct CancelMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"market",
            crate::id().as_ref(),
            market.creator.as_ref(),
            &market.fixture_id.to_le_bytes(),
        ],
        bump = market.bump,
        constraint = market.creator == creator.key() @ FullTimeError::UnauthorizedCancel,
    )]
    pub market: Account<'info, Market>,
}

// ─── Core CPI Logic ────────────────────────────────────────────────

/// Melakukan CPI call ke TxLINE `validate_stat` untuk verifikasi satu stat.
///
/// Returns: `Ok(())` jika stat valid dan predicate terpenuhi.
/// Errors: propagates CPI error jika Merkle proof gagal atau predicate tidak terpenuhi.
fn verify_stat(
    target_ts: i64,
    fixture_summary: &ScoresBatchSummary,
    fixture_proof: &[ProofNode],
    main_tree_proof: &[ProofNode],
    stat: &StatTerm,
    daily_scores_merkle_roots: &AccountInfo,
) -> Result<()> {
    let predicate = TraderPredicate {
        threshold: -1, // lolos jika value > -1 (selalu true utk gol >= 0)
        comparison: Comparison::GreaterThan,
    };

    let mut data = Vec::new();
    data.extend_from_slice(&VALIDATE_STAT_DISCRIMINATOR);
    data.extend_from_slice(&target_ts.to_le_bytes());

    // Serialize fixture_summary (Borsh-serialized struct)
    let mut fsa = Vec::new();
    fixture_summary.serialize(&mut fsa)?;
    data.extend_from_slice(&fsa);

    // Serialize fixture_proof (Vec<ProofNode> — 4-byte Borsh len prefix)
    let mut fpa = Vec::new();
    (fixture_proof.len() as u32).serialize(&mut fpa)?;
    for node in fixture_proof {
        node.serialize(&mut fpa)?;
    }
    data.extend_from_slice(&fpa);

    // Serialize main_tree_proof
    let mut mta = Vec::new();
    (main_tree_proof.len() as u32).serialize(&mut mta)?;
    for node in main_tree_proof {
        node.serialize(&mut mta)?;
    }
    data.extend_from_slice(&mta);

    // predicate (TraderPredicate)
    predicate.serialize(&mut data)?;

    // stat_a (the stat we're proving)
    stat.serialize(&mut data)?;

    // stat_b = None (Option<StatTerm>)
    data.push(0u8);

    // op = None (Option<BinaryExpression>)
    data.push(0u8);

    let daily_meta = anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
        daily_scores_merkle_roots.key(),
        false,
    );

    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::instruction::Instruction {
            program_id: TXLINE_TXORACLE_ID,
            accounts: vec![daily_meta],
            data,
        },
        &[daily_scores_merkle_roots.clone()],
    ).map_err(|_| error!(FullTimeError::MerkleVerificationFailed))?;

    Ok(())
}

// ─── Program ───────────────────────────────────────────────────────

#[program]
pub mod fulltime {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: u64,
        question: String,
        betting_open_time: i64,
        betting_close_time: i64,
    ) -> Result<()> {
        require!(
            question.len() <= 200,
            FullTimeError::QuestionTooLong
        );
        require!(
            betting_close_time > betting_open_time,
            FullTimeError::InvalidBettingWindow
        );
        require!(
            betting_open_time > Clock::get()?.unix_timestamp - 3600,
            FullTimeError::BettingCloseTimeInPast
        );

        let market = &mut ctx.accounts.market;
        market.fixture_id = fixture_id;
        market.question = question.clone();
        market.creator = ctx.accounts.creator.key();
        market.outcome_count = 3;
        market.total_pool = 0;
        market.pool_home = 0;
        market.pool_draw = 0;
        market.pool_away = 0;
        market.betting_open_time = betting_open_time;
        market.betting_close_time = betting_close_time;
        market.status = MarketStatus::Pending;
        market.winning_option = 255;
        market.settlement_root = Pubkey::default();
        market.settlement_epoch_day = 0;
        market.settlement_ts = 0;
        market.dispute_until = 0;
        market.fee_bps = PLATFORM_FEE_BPS;
        market.bump = ctx.bumps.market;

        emit!(MarketCreated {
            market: market.key(),
            fixture_id,
            creator: ctx.accounts.creator.key(),
            question,
            betting_close_time,
        });

        Ok(())
    }

    pub fn open_market(ctx: Context<CloseBetting>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            market.status == MarketStatus::Pending,
            FullTimeError::InvalidMarketStatus
        );
        market.status = MarketStatus::Open;
        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        option_index: u8,
        amount: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bettor = &ctx.accounts.bettor;

        require!(
            market.status == MarketStatus::Open,
            FullTimeError::MarketNotOpen
        );
        require!(
            Clock::get()?.unix_timestamp < market.betting_close_time,
            FullTimeError::BettingClosed
        );
        require!(
            option_index < market.outcome_count,
            FullTimeError::InvalidOptionIndex
        );
        require!(amount > 0, FullTimeError::InsufficientFunds);

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: bettor.to_account_info(),
                    to: market.to_account_info(),
                },
            ),
            amount,
        )?;

        market.total_pool = market
            .total_pool
            .checked_add(amount)
            .ok_or(FullTimeError::MathOverflow)?;

        match option_index {
            0 => {
                market.pool_home = market
                    .pool_home
                    .checked_add(amount)
                    .ok_or(FullTimeError::MathOverflow)?;
            }
            1 => {
                market.pool_draw = market
                    .pool_draw
                    .checked_add(amount)
                    .ok_or(FullTimeError::MathOverflow)?;
            }
            2 => {
                market.pool_away = market
                    .pool_away
                    .checked_add(amount)
                    .ok_or(FullTimeError::MathOverflow)?;
            }
            _ => unreachable!(),
        }

        let bet = &mut ctx.accounts.bet;
        bet.market = market.key();
        bet.bettor = bettor.key();
        bet.option_index = option_index;
        bet.amount = amount;
        bet.claimed = false;
        bet.bump = ctx.bumps.bet;

        emit!(BetPlaced {
            market: market.key(),
            bettor: bettor.key(),
            option_index,
            amount,
        });

        Ok(())
    }

    pub fn close_betting(ctx: Context<CloseBetting>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            market.status == MarketStatus::Open,
            FullTimeError::InvalidMarketStatus
        );
        require!(
            Clock::get()?.unix_timestamp >= market.betting_close_time,
            FullTimeError::InvalidMarketStatus
        );
        market.status = MarketStatus::Closed;
        Ok(())
    }

    pub fn settle_market(
        ctx: Context<SettleMarket>,
        target_ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        stat_a: StatTerm,
        stat_b: StatTerm,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;

        require!(
            market.status == MarketStatus::Closed,
            FullTimeError::MarketNotClosed
        );

        // Verifikasi fixture_id cocok
        require!(
            fixture_summary.fixture_id as u64 == market.fixture_id,
            FullTimeError::MerkleVerificationFailed
        );

        // Verifikasi daily_scores_merkle_roots adalah PDA valid dari TxLINE
        let epoch_day = ((target_ts / 86400) as u16).to_le_bytes();
        let (expected_pda, _bump) = Pubkey::find_program_address(
            &[b"daily_scores_roots", &epoch_day],
            &TXLINE_TXORACLE_ID,
        );
        require!(
            ctx.accounts.daily_scores_merkle_roots.key() == expected_pda,
            FullTimeError::InvalidDailyScoresRoots
        );

        // CPI #1: verifikasi stat_a (HOME goals, key=1)
        verify_stat(
            target_ts,
            &fixture_summary,
            &fixture_proof,
            &main_tree_proof,
            &stat_a,
            &ctx.accounts.daily_scores_merkle_roots,
        )?;

        // CPI #2: verifikasi stat_b (AWAY goals, key=2)
        verify_stat(
            target_ts,
            &fixture_summary,
            &fixture_proof,
            &main_tree_proof,
            &stat_b,
            &ctx.accounts.daily_scores_merkle_roots,
        )?;

        // Tentukan pemenang
        let home_goals = stat_a.stat_to_prove.value;
        let away_goals = stat_b.stat_to_prove.value;

        require!(home_goals >= 0, FullTimeError::InvalidStatValue);
        require!(away_goals >= 0, FullTimeError::InvalidStatValue);

        let winning_option = if home_goals > away_goals {
            0u8
        } else if home_goals == away_goals {
            1u8
        } else {
            2u8
        };

        let now = Clock::get()?.unix_timestamp;
        market.status = MarketStatus::Settled;
        market.winning_option = winning_option;
        market.settlement_root = ctx.accounts.daily_scores_merkle_roots.key();
        market.settlement_epoch_day = (target_ts / 86400) as u16;
        market.settlement_ts = now;
        market.dispute_until = now
            .checked_add(DISPUTE_WINDOW_SECONDS)
            .ok_or(FullTimeError::MathOverflow)?;

        emit!(MarketSettled {
            market: market.key(),
            fixture_id: market.fixture_id,
            winning_option,
            home_goals,
            away_goals,
            settlement_root: ctx.accounts.daily_scores_merkle_roots.key(),
        });

        Ok(())
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;
        let bettor = &ctx.accounts.bettor;

        require!(
            market.status == MarketStatus::Settled,
            FullTimeError::ClaimNotAvailable
        );
        require!(!bet.claimed, FullTimeError::AlreadyClaimed);
        require!(
            bet.option_index == market.winning_option,
            FullTimeError::NotWinner
        );

        let winning_pool = match market.winning_option {
            0 => market.pool_home,
            1 => market.pool_draw,
            2 => market.pool_away,
            _ => return Err(FullTimeError::MathOverflow.into()),
        };

        if winning_pool == 0 {
            return Err(FullTimeError::InsufficientFunds.into());
        }

        let gross_payout = (bet.amount as u128)
            .checked_mul(market.total_pool as u128)
            .ok_or(FullTimeError::MathOverflow)?
            .checked_div(winning_pool as u128)
            .ok_or(FullTimeError::MathOverflow)?;

        let fee = gross_payout
            .checked_mul(market.fee_bps as u128)
            .ok_or(FullTimeError::MathOverflow)?
            .checked_div(10000u128)
            .ok_or(FullTimeError::MathOverflow)?;

        let net_payout = gross_payout
            .checked_sub(fee)
            .ok_or(FullTimeError::MathOverflow)? as u64;

        require!(net_payout > 0, FullTimeError::InsufficientFunds);

        **market.to_account_info().try_borrow_mut_lamports()? = market
            .to_account_info()
            .lamports()
            .checked_sub(net_payout)
            .ok_or(FullTimeError::MathOverflow)?;

        **bettor.to_account_info().try_borrow_mut_lamports()? = bettor
            .to_account_info()
            .lamports()
            .checked_add(net_payout)
            .ok_or(FullTimeError::MathOverflow)?;

        bet.claimed = true;

        emit!(PayoutClaimed {
            market: market.key(),
            bettor: bettor.key(),
            amount: net_payout,
        });

        Ok(())
    }

    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            market.status == MarketStatus::Closed
                || market.status == MarketStatus::Open
                || market.status == MarketStatus::Pending,
            FullTimeError::InvalidMarketStatus
        );
        market.status = MarketStatus::Cancelled;
        Ok(())
    }
}
