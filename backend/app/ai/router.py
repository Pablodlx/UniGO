"""
AI assistant router for UniGO questions
"""
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.auth.router import get_current_user
from app.auth.models import User

log = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Assistant"])


class AskRequest(BaseModel):
    """Request to ask a question to the AI assistant"""
    message: str = Field(..., min_length=1, max_length=2000)


class AskResponse(BaseModel):
    """Response from the AI assistant"""
    success: bool
    response: str
    error: Optional[str] = None


def get_openai_api_key() -> Optional[str]:
    """Get OpenAI API key from environment"""
    # Load .env file explicitly (same pattern as email service)
    from dotenv import load_dotenv
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(backend_dir, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path, override=True)
    
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    return api_key if api_key else None


def load_unigo_context() -> str:
    """Load UniGO context from context.txt file"""
    try:
        context_file = Path(__file__).parent / "context.txt"
        if context_file.exists():
            return context_file.read_text(encoding="utf-8")
        else:
            log.warning("AI context file not found")
            return "Eres un asistente de UniGO, una plataforma de carpooling universitario."
    except Exception as e:
        log.error(f"Error loading AI context: {e}")
        return "Eres un asistente de UniGO, una plataforma de carpooling universitario."


@router.post("/ask", response_model=AskResponse)
def ask_ai_assistant(
    request: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ask a question to the AI assistant about UniGO.
    
    The assistant has context about how UniGO works and can answer
    questions about trips, bookings, payments, alerts, etc.
    """
    api_key = get_openai_api_key()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured"
        )
    
    try:
        from openai import OpenAI
        
        # Load UniGO context
        system_context = load_unigo_context()
        
        print(f"[AI] User {current_user.id} asked: {request.message[:100]}...", flush=True)
        log.info(f"[AI] User {current_user.id} asked: {request.message[:100]}...")
        log.info(f"[AI] API key present: {bool(api_key)}")
        log.info(f"[AI] Context loaded: {len(system_context)} chars")
        
        # Create OpenAI client
        client = OpenAI(api_key=api_key)
        
        print(f"[AI] Calling OpenAI API with model gpt-4o-mini...", flush=True)
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Fast and cost-effective
            messages=[
                {
                    "role": "system",
                    "content": system_context
                },
                {
                    "role": "user",
                    "content": request.message
                }
            ],
            max_tokens=500,  # Limit to prevent excessive costs
            temperature=0.7,
        )
        
        # Extract response
        assistant_message = response.choices[0].message.content
        
        print(f"[AI] ✅ Response generated ({len(assistant_message)} chars)", flush=True)
        log.info(f"[AI] Response generated for user {current_user.id}: {len(assistant_message)} chars")
        
        return AskResponse(
            success=True,
            response=assistant_message
        )
        
    except ImportError as e:
        print(f"[AI] ❌ OpenAI library not installed: {e}", flush=True)
        log.error(f"[AI] OpenAI library not installed: {e}")
        
        # Return fallback response
        fallback_message = "El servicio de asistente no está disponible en este momento. Por favor, consulta la documentación o contacta con soporte."
        return AskResponse(
            success=False,
            response=fallback_message,
            error="OpenAI library not installed"
        )
    
    except Exception as e:
        print(f"[AI] ❌ Error calling OpenAI API: {e}", flush=True)
        log.error(f"[AI] Error calling OpenAI API: {e}", exc_info=True)
        
        # Handle specific OpenAI errors
        error_message = str(e)
        fallback_message = "Estoy teniendo dificultades para procesar tu mensaje, ¿puedes intentarlo de nuevo?"
        
        # Rate limit / Quota exceeded
        if "429" in error_message or "quota" in error_message.lower() or "rate_limit" in error_message.lower():
            fallback_message = "El servicio de asistente ha alcanzado su límite de uso. Por favor, inténtalo más tarde o contacta con soporte."
            print(f"[AI] ⚠️ Rate limit / Quota exceeded", flush=True)
        
        # Authentication error
        elif "401" in error_message or "authentication" in error_message.lower():
            fallback_message = "Error de autenticación con el servicio de IA. Por favor, contacta con soporte."
            print(f"[AI] ⚠️ Authentication error", flush=True)
        
        # Invalid request
        elif "400" in error_message or "invalid" in error_message.lower():
            fallback_message = "Tu pregunta no pudo ser procesada. Por favor, intenta reformularla."
            print(f"[AI] ⚠️ Invalid request", flush=True)
        
        # Server error
        elif "500" in error_message or "internal" in error_message.lower():
            fallback_message = "El servicio de IA está experimentando problemas. Por favor, inténtalo de nuevo en unos momentos."
            print(f"[AI] ⚠️ Server error", flush=True)
        
        return AskResponse(
            success=False,
            response=fallback_message,
            error=error_message
        )

