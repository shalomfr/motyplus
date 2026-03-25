"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const DOMAIN_SUGGESTIONS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "walla.co.il",
  "walla.com",
  "013.net",
  "bezeqint.net",
  "netvision.net.il",
  "zahav.net.il",
  "icloud.com",
  "live.com",
]

export interface EmailInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onValueChange?: (value: string) => void
}

const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  ({ className, onValueChange, onChange, onBlur, ...props }, ref) => {
    const [showSuggestions, setShowSuggestions] = React.useState(false)
    const [suggestions, setSuggestions] = React.useState<string[]>([])
    const [selectedIndex, setSelectedIndex] = React.useState(-1)
    const [internalValue, setInternalValue] = React.useState(
      (props.value as string) || (props.defaultValue as string) || ""
    )
    const wrapperRef = React.useRef<HTMLDivElement>(null)

    const currentValue = (props.value as string) ?? internalValue

    const updateSuggestions = (val: string) => {
      const atIndex = val.indexOf("@")
      if (atIndex === -1 || atIndex === 0) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      const localPart = val.substring(0, atIndex)
      const domainPart = val.substring(atIndex + 1)

      const filtered = DOMAIN_SUGGESTIONS.filter((d) =>
        d.startsWith(domainPart.toLowerCase())
      )

      if (filtered.length === 0 || (filtered.length === 1 && filtered[0] === domainPart)) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setSuggestions(filtered.map((d) => `${localPart}@${d}`))
      setShowSuggestions(true)
      setSelectedIndex(-1)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setInternalValue(val)
      updateSuggestions(val)
      onChange?.(e)
      onValueChange?.(val)
    }

    const selectSuggestion = (suggestion: string) => {
      setInternalValue(suggestion)
      setShowSuggestions(false)
      onValueChange?.(suggestion)

      // Update the underlying input for react-hook-form
      const input = wrapperRef.current?.querySelector("input")
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set
        nativeInputValueSetter?.call(input, suggestion)
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault()
        selectSuggestion(suggestions[selectedIndex])
      } else if (e.key === "Escape") {
        setShowSuggestions(false)
      } else if (e.key === "Tab" && suggestions.length > 0) {
        const idx = selectedIndex >= 0 ? selectedIndex : 0
        selectSuggestion(suggestions[idx])
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Delay to allow click on suggestion
      setTimeout(() => {
        setShowSuggestions(false)
      }, 150)

      // Auto-append @gmail.com if no @
      const val = e.target.value.trim()
      if (val && !val.includes("@")) {
        const full = val + "@gmail.com"
        setInternalValue(full)
        onValueChange?.(full)
        const input = wrapperRef.current?.querySelector("input")
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          )?.set
          nativeInputValueSetter?.call(input, full)
          input.dispatchEvent(new Event("input", { bubbles: true }))
          input.dispatchEvent(new Event("change", { bubbles: true }))
        }
      }

      onBlur?.(e)
    }

    // Close dropdown on outside click
    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setShowSuggestions(false)
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
      <div ref={wrapperRef} className="relative">
        <input
          type="email"
          className={cn(
            "flex h-10 w-full rounded-md glass-input text-gray-900 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right",
            className
          )}
          dir="ltr"
          ref={ref}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="email@example.com"
          autoComplete="off"
          {...props}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-auto"
            dir="ltr"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-left",
                  index === selectedIndex && "bg-blue-100"
                )}
                onMouseDown={() => selectSuggestion(suggestion)}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
)
EmailInput.displayName = "EmailInput"

export { EmailInput }
