"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, ShieldCheck } from "lucide-react";
import {
  archiveInternalDocument,
  createInternalDocument,
  DOCUMENT_ROLES,
  fetchInternalDocuments,
  searchOperations,
  updateInternalDocument,
  type NewInternalDocument,
} from "@/features/ops-documents";
import { ADMIN_ROLE_LABEL } from "@/shared/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { SelectField } from "@/shared/ui/select-field";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState } from "@/shared/ui/query-state";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { seoulDateTime, toggleValue } from "@/shared/lib/utils";

const DOCUMENT_TYPES = [
  { value: "MANUAL", label: "운영 매뉴얼" },
  { value: "GUIDELINE", label: "지침" },
  { value: "EMERGENCY", label: "비상 대응" },
  { value: "CONTACT", label: "연락처·조직도" },
  { value: "ETC", label: "기타" },
];

const EMPTY_DOCUMENT: NewInternalDocument = {
  title: "", documentType: "MANUAL", body: "", sourceUrl: "",
  allowedRoles: ["SUPER_ADMIN", "FESTIVAL_MANAGER"],
};

export default function DocumentsPage() {
  const { form, set, field, setForm, reset } = useForm<NewInternalDocument>(EMPTY_DOCUMENT);
  const [question, setQuestion] = useState("");

  const documents = useQuery({ queryKey: ["internal-documents"], queryFn: fetchInternalDocuments });
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const invalidates = ["internal-documents"];
  const create = useWrite(createInternalDocument, {
    success: "운영 문서를 등록했어요.", invalidates, onSuccess: reset,
  });
  // 결과가 화면에 그대로 드러나는 검색은 성공 알림을 띄우지 않는다(meta.silent).
  const search = useWrite(searchOperations, { silent: true });
  const update = useWrite(({ id, title }: { id: string; title: string }) => updateInternalDocument(id, { title }), {
    success: "문서를 수정했어요.", invalidates, onSuccess: () => setEditing(null),
  });
  const archive = useWrite(archiveInternalDocument, { success: "문서를 보관했어요.", invalidates });

  function toggleRole(role: string) {
    setForm((previous) => ({
      ...previous,
      allowedRoles: toggleValue(previous.allowedRoles, role),
    }));
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        운영 매뉴얼·지침을 등록하고 자연어로 검색해요. 검색은 본인 역할이 열람할 수 있는 문서만 찾고, 결과 본문의 연락처·이메일은 자동으로 마스킹돼요.
      </p>

      <section className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Search className="size-4 text-primary" /> 운영 문서 검색</h2>
        <Form className="mt-3 flex flex-wrap gap-2" onSubmit={() => search.mutate(question)}>
          <Input
            className="min-w-56 flex-1"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={2}
            required
            placeholder="예: 우천 시 공연 취소 절차는 어떻게 되나요?"
          />
          <SubmitButton mutation={search} pending="검색 중...">검색</SubmitButton>
        </Form>

        {search.isPending && <Skeleton className="mt-3 h-20 w-full rounded-xl" />}
        <ErrorText error={search.error} className="mt-3" />
        {search.data && (
          <div className="mt-3 rounded-xl border border-border bg-background p-4">
            <p className="flex items-center gap-1 text-[0.6875rem] font-semibold text-primary">
              <ShieldCheck className="size-3" /> 권한 범위 문서 · 개인정보 마스킹 적용
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{search.data.answer}</p>
            {search.data.sources.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2">
                {search.data.sources.map((source) => (
                  <li key={source.documentId}>
                    <Badge variant="outline" className="text-[0.625rem]">{source.title}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><FileText className="size-4 text-primary" /> 운영 문서 등록</h2>
        <Form className="mt-3 space-y-3" onSubmit={() => create.mutate({ ...form, sourceUrl: form.sourceUrl || undefined })}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="doc-title">제목</Label>
              <Input id="doc-title" {...field("title")} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-type">문서 유형</Label>
              <SelectField value={form.documentType} onValueChange={set("documentType")} options={DOCUMENT_TYPES} aria-label="문서 유형" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-url">원문 링크(선택)</Label>
              <Input id="doc-url" {...field("sourceUrl")} placeholder="https://" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-body">본문</Label>
            <Textarea id="doc-body" rows={5} {...field("body")} required placeholder="운영 절차, 비상 대응, 담당 부서 등을 적어주세요." />
          </div>
          <div className="space-y-1">
            <Label>열람 권한</Label>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_ROLES.map((role) => {
                const active = form.allowedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}
                  >
                    {ADMIN_ROLE_LABEL[role]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <ErrorText error={create.error} className="mr-auto" />
            <SubmitButton mutation={create} pending="등록 중..." disabled={form.allowedRoles.length === 0}>문서 등록</SubmitButton>
          </div>
        </Form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground">
          등록된 문서 {(documents.data?.length ?? 0) > 0 && `(${documents.data?.length})`}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">본인 역할이 열람할 수 있는 문서만 보여요.</p>
        <div className="mt-3">
          <QueryState query={documents} empty="등록된 운영 문서가 없어요." skeleton={<SkeletonList count={3} className="h-12 w-full rounded-xl" />}>
            {(rows) => (
              <ul className="space-y-2">
                {rows.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{document.title}</p>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {document.documentType}
                        {document.updatedAt && ` · ${seoulDateTime(document.updatedAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {document.allowedRoles.map((role) => (
                        <Badge key={role} variant="outline" className="text-[0.625rem]">{ADMIN_ROLE_LABEL[role] ?? role}</Badge>
                      ))}
                      {document.sourceUrl && (
                        <a href={document.sourceUrl} target="_blank" rel="noreferrer" className="text-[0.6875rem] font-medium text-primary hover:underline">
                          원문
                        </a>
                      )}
                      {/* 등록만 되고 고칠 수 없어서 오타 하나도 수정하지 못했다. */}
                      <Button size="sm" variant="ghost" className="text-[0.6875rem]"
                              onClick={() => setEditing({ id: document.id, title: document.title })}>
                        수정
                      </Button>
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        className="text-[0.6875rem] text-destructive"
                        title="문서를 보관할까요?"
                        description="보관하면 목록과 AI 운영 검색에서 빠져요. 기록은 남습니다."
                        confirmLabel="보관"
                        onConfirm={() => archive.mutate(document.id)}
                      >
                        보관
                      </ConfirmButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      </section>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서 제목 수정</DialogTitle>
          </DialogHeader>
          <Form className="space-y-3" onSubmit={() => editing && update.mutate(editing)}>
            <Input value={editing?.title ?? ""} required
                   onChange={(event) => setEditing(editing && { ...editing, title: event.target.value })} />
            <ErrorText error={update.error} />
            <SubmitButton mutation={update} pending="저장 중..." className="w-full">저장</SubmitButton>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
