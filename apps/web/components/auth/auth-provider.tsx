import type { AdditionalField } from "@better-auth-ui/core";
import {
  AuthProvider as AuthProviderPrimitive,
  type AuthProviderProps,
} from "@better-auth-ui/react";
import type { ComponentPropsWithoutRef, ComponentType, PropsWithChildren, ReactNode } from "react";

import { ErrorToaster } from "./error-toaster";

declare module "@better-auth-ui/core" {
  interface AuthConfig {
    /**
     * React component used to render internal navigation links.
     * Typically TanStack Router's `Link` or Next.js's `Link`.
     */
    Link: ComponentType<
      PropsWithChildren<
        { className?: string; href: string; to?: string } & Pick<
          ComponentPropsWithoutRef<"a">,
          "aria-disabled" | "tabIndex" | "onClick"
        >
      >
    >;
  }

  /**
   * Widen `AdditionalField` slots for the shadcn package: `label` accepts any
   * React node, and custom `render` functions receive the field props and
   * return a React node (so they can be rendered as components directly).
   */
  interface AdditionalFieldRegister {
    label: ReactNode;
    renderProps: { name: string; field: AdditionalField; isPending?: boolean };
    renderResult: ReactNode;
  }
}

/**
 * Provides an authentication context by rendering an auth provider with the sonner toast handler injected, forwarding remaining configuration and rendering `children` inside it.
 *
 * @param children - React nodes to render inside the authentication provider
 * @returns A React element that renders an authentication provider configured with the provided props and toast handler
 */
export function AuthProvider({ children, ...config }: AuthProviderProps) {
  return (
    <AuthProviderPrimitive {...config}>
      {children}

      <ErrorToaster />
    </AuthProviderPrimitive>
  );
}
