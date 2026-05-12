from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from server.database import SessionLocal, init_db
from server.models.db import User, Workspace, Form, Submission as SubmissionModel
from server.models import (
    WorkspaceCreate, WorkspaceOut,
    FormCreate, FormUpdate, FormOut,
    SubmissionCreate, SubmissionOut,
    MoveFormRequest,
)

router = APIRouter(prefix="/api/data")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_user(db: Session, address: str) -> User:
    user = db.query(User).filter(User.address == address.lower()).first()
    if not user:
        user = User(address=address.lower())
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _ws_out(ws: Workspace, db: Session) -> WorkspaceOut:
    form_ids = [f.uuid for f in db.query(Form).filter(Form.workspace_uuid == ws.uuid).all()]
    return WorkspaceOut(
        uuid=ws.uuid,
        name=ws.name,
        description=ws.description or "",
        formIds=form_ids,
        createdAt=ws.created_at.isoformat(),
        updatedAt=ws.updated_at.isoformat(),
    )


def _form_out(f: Form) -> FormOut:
    return FormOut(
        id=f.uuid,
        title=f.title or "",
        description=f.description or "",
        workspaceId=f.workspace_uuid,
        fields=f.fields or [],
        blobId=f.blob_id,
        profilePicture=f.profile_picture,
        coverPicture=f.cover_picture,
        createdAt=f.created_at.isoformat(),
        updatedAt=f.updated_at.isoformat(),
    )


def _sub_out(s: SubmissionModel) -> SubmissionOut:
    return SubmissionOut(
        id=s.uuid,
        formId=s.form_uuid,
        data=s.data or {},
        walletAddress=s.wallet_address,
        submittedAt=s.submitted_at.isoformat(),
        blobId=s.blob_id,
    )


# --- Workspaces ---

@router.get("/workspaces")
def list_workspaces(address: str):
    db = next(get_db())
    try:
        user = _get_or_create_user(db, address)
        workspaces = db.query(Workspace).filter(Workspace.user_address == user.address).all()
        if not workspaces:
            default = Workspace(name="Default", user_address=user.address)
            db.add(default)
            db.commit()
            workspaces = [default]
        return [_ws_out(ws, db) for ws in workspaces]
    finally:
        db.close()


@router.post("/workspaces")
def create_workspace(body: WorkspaceCreate, address: str):
    db = next(get_db())
    try:
        user = _get_or_create_user(db, address)
        ws = Workspace(name=body.name, description=body.description, user_address=user.address)
        db.add(ws)
        db.commit()
        db.refresh(ws)
        return _ws_out(ws, db)
    finally:
        db.close()


@router.put("/workspaces/{uuid}")
def rename_workspace(uuid: str, name: str, address: str):
    db = next(get_db())
    try:
        ws = db.query(Workspace).filter(Workspace.uuid == uuid, Workspace.user_address == address.lower()).first()
        if not ws:
            raise HTTPException(404, "Workspace not found")
        ws.name = name
        db.commit()
        db.refresh(ws)
        return _ws_out(ws, db)
    finally:
        db.close()


@router.delete("/workspaces/{uuid}")
def delete_workspace(uuid: str, address: str):
    db = next(get_db())
    try:
        ws = db.query(Workspace).filter(Workspace.uuid == uuid, Workspace.user_address == address.lower()).first()
        if not ws:
            raise HTTPException(404, "Workspace not found")
        remaining = db.query(Workspace).filter(Workspace.user_address == address.lower()).count()
        if remaining <= 1:
            raise HTTPException(400, "Cannot delete the last workspace")
        db.query(Form).filter(Form.workspace_uuid == uuid).delete()
        db.delete(ws)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# --- Forms ---

@router.get("/forms")
def list_forms(address: str, workspace_id: Optional[str] = None):
    db = next(get_db())
    try:
        q = db.query(Form).filter(Form.user_address == address.lower())
        if workspace_id:
            q = q.filter(Form.workspace_uuid == workspace_id)
        forms = q.all()
        return [_form_out(f) for f in forms]
    finally:
        db.close()


@router.post("/forms")
def create_form(body: FormCreate, address: str):
    db = next(get_db())
    try:
        user = _get_or_create_user(db, address)
        ws = db.query(Workspace).filter(Workspace.uuid == body.workspace_uuid).first()
        if not ws:
            first = db.query(Workspace).filter(Workspace.user_address == user.address).first()
            if not first:
                first = Workspace(name="Default", user_address=user.address)
                db.add(first)
                db.commit()
                db.refresh(first)
            body.workspace_uuid = first.uuid
        f = Form(
            title=body.title,
            description=body.description,
            workspace_uuid=body.workspace_uuid,
            user_address=user.address,
            fields=body.fields,
            profile_picture=body.profile_picture,
            cover_picture=body.cover_picture,
        )
        db.add(f)
        db.commit()
        db.refresh(f)
        return _form_out(f)
    finally:
        db.close()


@router.get("/forms/{uuid}")
def get_form(uuid: str):
    db = next(get_db())
    try:
        f = db.query(Form).filter(Form.uuid == uuid).first()
        if not f:
            raise HTTPException(404, "Form not found")
        return _form_out(f)
    finally:
        db.close()


@router.put("/forms/{uuid}")
def update_form(uuid: str, body: FormUpdate, address: str):
    db = next(get_db())
    try:
        f = db.query(Form).filter(Form.uuid == uuid, Form.user_address == address.lower()).first()
        if not f:
            raise HTTPException(404, "Form not found")
        if body.title is not None:
            f.title = body.title
        if body.description is not None:
            f.description = body.description
        if body.fields is not None:
            f.fields = body.fields
        if body.blob_id is not None:
            f.blob_id = body.blob_id
        if body.profile_picture is not None:
            f.profile_picture = body.profile_picture
        if body.cover_picture is not None:
            f.cover_picture = body.cover_picture
        db.commit()
        db.refresh(f)
        return _form_out(f)
    finally:
        db.close()


@router.delete("/forms/{uuid}")
def delete_form(uuid: str, address: str):
    db = next(get_db())
    try:
        f = db.query(Form).filter(Form.uuid == uuid, Form.user_address == address.lower()).first()
        if not f:
            raise HTTPException(404, "Form not found")
        db.query(SubmissionModel).filter(SubmissionModel.form_uuid == uuid).delete()
        db.delete(f)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@router.put("/forms/{uuid}/move")
def move_form(uuid: str, body: MoveFormRequest, address: str):
    db = next(get_db())
    try:
        f = db.query(Form).filter(Form.uuid == uuid, Form.user_address == address.lower()).first()
        if not f:
            raise HTTPException(404, "Form not found")
        ws = db.query(Workspace).filter(Workspace.uuid == body.workspace_uuid).first()
        if not ws:
            raise HTTPException(404, "Workspace not found")
        f.workspace_uuid = body.workspace_uuid
        db.commit()
        db.refresh(f)
        return _form_out(f)
    finally:
        db.close()


# --- Submissions ---

@router.get("/submissions")
def list_submissions(form_uuid: str):
    db = next(get_db())
    try:
        subs = db.query(SubmissionModel).filter(SubmissionModel.form_uuid == form_uuid).all()
        return [_sub_out(s) for s in subs]
    finally:
        db.close()


@router.post("/submissions")
def create_submission(body: SubmissionCreate, form_uuid: str):
    db = next(get_db())
    try:
        f = db.query(Form).filter(Form.uuid == form_uuid).first()
        if not f:
            raise HTTPException(404, "Form not found")
        s = SubmissionModel(
            form_uuid=form_uuid,
            data=body.data,
            wallet_address=body.walletAddress,
        )
        db.add(s)
        db.commit()
        db.refresh(s)
        return _sub_out(s)
    finally:
        db.close()


@router.delete("/submissions/{uuid}")
def delete_submission(uuid: str, address: str):
    db = next(get_db())
    try:
        s = db.query(SubmissionModel).filter(SubmissionModel.uuid == uuid).first()
        if not s:
            raise HTTPException(404, "Submission not found")
        form = db.query(Form).filter(Form.uuid == s.form_uuid, Form.user_address == address.lower()).first()
        if not form:
            raise HTTPException(403, "Not your form")
        db.delete(s)
        db.commit()
        return {"ok": True}
    finally:
        db.close()
