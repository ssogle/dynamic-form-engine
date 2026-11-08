"use client";

import * as React from "react";
import type { Form } from "@/entities/form";
import { extractActiveFields, validateSubmissionData } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";
import { useUpdateSubmissionMutation } from "@/entities/form-submission";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";

interface EditSubmissionFormBodyProps {
  form: Form;
  submission: FormSubmission;
  onClose: () => void;
}

/**
 * 응답 수정 폼 내부 본문 컴포넌트
 *
 * key={submission.id}로 마운트되어 useEffect 없이 초기 폼 상태를 안전하게 바인딩합니다.
 */
function EditSubmissionFormBody({ form, submission, onClose }: EditSubmissionFormBodyProps) {
  const [formData, setFormData] = React.useState<Record<string, unknown>>(() => ({
    ...(submission.data ?? {}),
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { mutateAsync: updateSubmission } = useUpdateSubmissionMutation(form.id);
  const activeFields = extractActiveFields(form);

  const handleInputChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSave = async () => {
    // 동적 Zod 스키마 런타임 유효성 검증
    const validationResult = validateSubmissionData(activeFields, formData);

    if (!validationResult.isValid) {
      setErrors(validationResult.errors);
      return;
    }

    try {
      setIsSubmitting(true);
      await updateSubmission({
        submissionId: submission.id,
        data: validationResult.cleanedData ?? {},
      });
      onClose();
    } catch (err) {
      console.error("응답 수정 실패:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-4 py-3">
        {activeFields.map((field) => {
          const value = formData[field.name];
          const error = errors[field.name];

          return (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={`edit-${field.id}`} className="text-xs font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {field.type === "textarea" ? (
                <Textarea
                  id={`edit-${field.id}`}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className="min-h-20 text-xs"
                />
              ) : field.type === "select" ? (
                <Select
                  value={typeof value === "string" ? value : ""}
                  onValueChange={(val) => handleInputChange(field.name, val)}
                >
                  <SelectTrigger id={`edit-${field.id}`} className="w-full text-xs">
                    <SelectValue placeholder={field.placeholder || "선택해 주세요"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`edit-${field.id}`}
                  type={field.type === "number" ? "number" : "text"}
                  value={value !== undefined && value !== null ? String(value) : ""}
                  onChange={(e) =>
                    handleInputChange(
                      field.name,
                      field.type === "number" ? e.target.value : e.target.value
                    )
                  }
                  placeholder={field.placeholder}
                  className="h-9 text-xs"
                />
              )}

              {error && (
                <p className="text-destructive text-[11px] font-medium" role="alert">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
          취소
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : "변경사항 저장"}
        </Button>
      </DialogFooter>
    </>
  );
}

export interface EditSubmissionDialogProps {
  form: Form;
  submission: FormSubmission | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 기제출된 응답 데이터 수정 다이얼로그 컴포넌트
 */
export function EditSubmissionDialog({
  form,
  submission,
  isOpen,
  onClose,
}: EditSubmissionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">제출된 응답 수정</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            응답 데이터를 수정합니다. 수정된 데이터는 폼 스키마 제약조건에 맞춰 재검증됩니다.
          </DialogDescription>
        </DialogHeader>

        {submission && (
          <EditSubmissionFormBody
            key={submission.id}
            form={form}
            submission={submission}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
