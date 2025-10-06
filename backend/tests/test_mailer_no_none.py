import pytest
from app.core import mailer

@pytest.mark.asyncio
async def test_mailer_rejects_none():
    with pytest.raises(ValueError):
        await mailer.send_verification_email("a@b.com", "")
    with pytest.raises(ValueError):
        # @ts-ignore: forzamos None
        await mailer.send_verification_email("a@b.com", None)  # type: ignore
