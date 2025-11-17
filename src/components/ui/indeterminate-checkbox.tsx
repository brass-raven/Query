import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface IndeterminateCheckboxProps extends Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, 'checked'> {
  checked?: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

function IndeterminateCheckbox({
  className,
  checked = false,
  indeterminate = false,
  onCheckedChange,
  ...props
}: IndeterminateCheckboxProps) {
  const checkboxRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (checkboxRef.current) {
      // Access the underlying input element for indeterminate property
      const input = checkboxRef.current.querySelector('input')
      if (input) {
        input.indeterminate = indeterminate
      }
    }
  }, [indeterminate])

  return (
    <CheckboxPrimitive.Root
      ref={checkboxRef}
      data-slot="checkbox"
      className={cn(
        "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      checked={indeterminate ? "indeterminate" : checked}
      onCheckedChange={onCheckedChange}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        {indeterminate ? (
          <MinusIcon className="size-3.5" />
        ) : (
          <CheckIcon className="size-3.5" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { IndeterminateCheckbox }
