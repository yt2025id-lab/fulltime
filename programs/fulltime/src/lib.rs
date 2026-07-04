use anchor_lang::prelude::*;

declare_id!("2L1YbuAks47q5CmVF5iXFQe2kCF3xYZKARkhNDRyL2jz");

#[program]
pub mod fulltime {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
