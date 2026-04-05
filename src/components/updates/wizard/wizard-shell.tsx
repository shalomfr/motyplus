"use client"

import { useState, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface WizardStep {
  key: string
  label: string
  icon: ReactNode
}

interface WizardShellProps {
  steps: WizardStep[]
  currentStep: number
  onStepChange: (step: number) => void
  canGoNext: boolean
  nextLabel?: string
  children: ReactNode
  completedSteps?: Set<number>
  hideNavigation?: boolean
}

function StepIndicator({
  step,
  index,
  isActive,
  isCompleted,
  onClick,
}: {
  step: WizardStep
  index: number
  isActive: boolean
  isCompleted: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg transition-all text-xs sm:text-sm font-medium min-h-[44px]",
        isActive && "bg-orange-100 text-blue-800 shadow-sm",
        isCompleted && !isActive && "text-green-700 hover:bg-green-50",
        !isActive && !isCompleted && "text-gray-400 hover:text-gray-600"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center w-7 h-7 sm:w-7 sm:h-7 rounded-full text-xs font-bold shrink-0 transition-all",
          isActive && "bg-blue-600 text-white",
          isCompleted && !isActive && "bg-green-500 text-white",
          !isActive && !isCompleted && "bg-gray-200 text-gray-500"
        )}
      >
        {isCompleted && !isActive ? <Check className="h-3.5 w-3.5" /> : index + 1}
      </span>
      <span className="hidden sm:inline">{step.label}</span>
      {isActive && <span className="sm:hidden text-[10px] max-w-[60px] truncate">{step.label}</span>}
    </button>
  )
}

export function WizardShell({
  steps,
  currentStep,
  onStepChange,
  canGoNext,
  nextLabel,
  children,
  completedSteps = new Set(),
  hideNavigation = false,
}: WizardShellProps) {
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="bg-white rounded-xl border p-1.5 sm:p-2 flex items-center gap-0.5 sm:gap-1 overflow-x-auto" dir="rtl">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <StepIndicator
              step={step}
              index={i}
              isActive={i === currentStep}
              isCompleted={completedSteps.has(i)}
              onClick={() => {
                if (completedSteps.has(i) || i <= currentStep) {
                  onStepChange(i)
                }
              }}
            />
            {i < steps.length - 1 && (
              <ChevronLeft className="h-4 w-4 text-gray-300 mx-1 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[250px] sm:min-h-[400px]">{children}</div>

      {/* Navigation */}
      {!hideNavigation && (
        <div className="flex items-center justify-between gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onStepChange(currentStep - 1)}
            disabled={isFirst}
          >
            <ChevronRight className="h-4 w-4 ml-1" />
            הקודם
          </Button>

          {!isLast && (
            <Button
              onClick={() => onStepChange(currentStep + 1)}
              disabled={!canGoNext}
            >
              {nextLabel || steps[currentStep + 1]?.label || "הבא"}
              <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
