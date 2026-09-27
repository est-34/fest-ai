"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import {
  createMembership,
  deactivateMembership,
  fetchMemberships,
  updateMembership,
  type Membership,
  type NewMembership,
} from "@/features/staff";
import { ADMIN_ROLE_LABEL, type AdminRole } from "@/shared/lib/permissions";
import { useForm } from "@/shared/lib/use-form";
import { isPendingFor, useWrite } from "@/shared/lib/use-write";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { ErrorState, QueryState, queryErrorMessage } from "@/shared/ui/query-state";
import { includesKeyword, useListView } from "@/shared/lib/use-list-view";
import { ListSearch, ShowMore } from "@/shared/ui/list-search";
import { SkeletonList } from "@/shared/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

const ROLES: AdminRole[] = ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR", "REVIEWER", "MERCHANT"];
const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ADMIN_ROLE_LABEL[role] }));

// festivalScope에 "*"를 넣으면 조직의 모든 축제에 접근한다. 비우면 축제별로 따로 지정해야 한다.
const EMPTY_FORM: NewMembership = { email: "", name: "", password: "", role: "FIELD_OPERATOR", festivalScope: ["*"] };

export default function MembersPage() {
  const { form, set, field, reset } = useForm<NewMembership>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [roleChange, setRoleChange] = useState<{ member: Membership; role: string } | null>(null);

  const memberships = useQuery({ queryKey: ["memberships"], queryFn: fetchMemberships, retry: false });
  const list = useListView(memberships.data, (member, keyword) =>
    includesKeyword(keyword, member.name, member.email, member.role),
  );
  const invalidates = ["memberships"];
  const create = useWrite(createMembership, {
    success: "계정을 만들었어요.", invalidates,
    onSuccess: () => { reset(); setCreating(false); },
  });
  const update = useWrite(updateMembership, { success: "계정 정보를 변경했어요.", invalidates });
  const deactivate = useWrite(deactivateMembership, { success: "계정을 비활성화했어요.", invalidates });

  if (memberships.isError) {
    return (
      <ErrorState
        message={`계정 목록을 불러오지 못했어요. 최고 관리자만 접근할 수 있어요. (${queryErrorMessage(memberships.error)})`}
        onRetry={() => memberships.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">운영자·검수자·현장 인력 계정과 역할, 축제 접근 범위를 관리해요.</p>
        <Button size="sm" onClick={() => setCreating(true)}><UserPlus className="size-3.5" /> 계정 추가</Button>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>계정 추가</DialogTitle>
            <DialogDescription>초기 비밀번호는 본인이 로그인한 뒤 변경하도록 안내해 주세요.</DialogDescription>
          </DialogHeader>
        <Form className="grid gap-3 sm:grid-cols-2" onSubmit={() => create.mutate(form)}>
          <div className="space-y-1">
            <Label htmlFor="member-name">이름</Label>
            <Input id="member-name" {...field("name")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-email">이메일</Label>
            <Input id="member-email" type="email" autoComplete="off" {...field("email")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-password">초기 비밀번호</Label>
            <Input id="member-password" type="password" autoComplete="new-password" minLength={8} {...field("password")} required />
          </div>
          <div className="space-y-1">
            <Label>역할</Label>
            <SelectField value={form.role} onValueChange={set("role")} options={ROLE_OPTIONS} aria-label="역할" />
          </div>
          <div className="sm:col-span-2 flex items-center justify-end gap-3">
            <ErrorText error={create.error} className="mr-auto" />
            <Button type="button" variant="outline" size="sm" onClick={() => setCreating(false)}>취소</Button>
            <SubmitButton mutation={create} pending="생성 중...">계정 생성</SubmitButton>
          </div>
        </Form>
        </DialogContent>
      </Dialog>

      <ListSearch
        value={list.query}
        onChange={list.setQuery}
        placeholder="이름·이메일·역할로 검색"
        count={list.filtered.length}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <QueryState
          query={memberships}
          className="m-4"
          empty="조건에 맞는 계정이 없어요."
          emptyWhen={list.filtered.length === 0}
          skeleton={<SkeletonList count={4} className="h-10 w-full" wrapperClassName="p-4" />}
        >
          {() => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>축제 범위</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.visible.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-foreground">{member.name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      {/* 권한 상향은 비활성화보다 위험한데 확인이 없었다 — 저장 전에 한 번 묻는다. */}
                      <SelectField
                        value={member.role}
                        onValueChange={(role) => setRoleChange({ member, role })}
                        options={ROLE_OPTIONS}
                        size="sm"
                        className="w-32"
                        aria-label="역할"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.festivalScope?.includes("*") ? "전체 축제" : `${member.festivalScope?.length ?? 0}개 축제`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === "ACTIVE" ? "secondary" : "outline"} className="text-[0.625rem]">{member.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {member.status === "ACTIVE" ? (
                        <ConfirmButton
                          size="sm"
                          variant="outline"
                          disabled={isPendingFor(deactivate, member.id)}
                          title="계정을 비활성화할까요?"
                          description={`${member.name}(${member.email}) 계정이 즉시 로그인할 수 없게 돼요. 다시 활성화할 수 있어요.`}
                          confirmLabel="비활성화"
                          onConfirm={() => deactivate.mutate(member.id)}
                        >
                          비활성화
                        </ConfirmButton>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPendingFor(update, member.id)}
                          onClick={() => update.mutate({ membershipId: member.id, status: "ACTIVE" })}
                        >
                          활성화
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
        <ShowMore hidden={list.hidden} onShowMore={list.showMore} />
      </div>

      <Dialog open={roleChange !== null} onOpenChange={(open) => !open && setRoleChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>역할을 바꿀까요?</DialogTitle>
            <DialogDescription>
              {roleChange && (
                <>
                  {roleChange.member.name}({roleChange.member.email})의 역할이{" "}
                  {ADMIN_ROLE_LABEL[roleChange.member.role] ?? roleChange.member.role} →{" "}
                  <b>{ADMIN_ROLE_LABEL[roleChange.role] ?? roleChange.role}</b>로 즉시 바뀝니다.
                  접근할 수 있는 화면과 승인 권한이 함께 달라져요.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>취소</DialogClose>
            <Button
              size="sm"
              disabled={update.isPending}
              onClick={() => {
                if (roleChange) update.mutate({ membershipId: roleChange.member.id, role: roleChange.role });
                setRoleChange(null);
              }}
            >
              역할 변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
