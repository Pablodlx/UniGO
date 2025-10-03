from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    is_verified: bool

    class Config:
        from_attributes = True


class VerifyEmail(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
