'use client';

import {useAuth} from '@/lib/auth-context';
import {LogOut, ShieldCheck} from 'lucide-react';
import {ExampleSection, PageBody} from '@/components/dashboard/page-body';
import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import {Checkbox} from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {Input} from '@/components/ui/input';
import {Separator} from '@/components/ui/separator';

export default function SettingsPage() {
  const {user, logout} = useAuth();

  return (
    <PageBody
      title="Settings"
      description="Manage your profile, session and preferences."
    >
      <div className="grid grid-cols-12 gap-6">
        {/* ---------------------------- Profile ---------------------------- */}
        <div className="col-span-12 xl:col-span-7">
          <Card className="ring-0 border rounded-2xl">
            <CardContent className="flex flex-col gap-6 p-6">
              <div className="flex flex-col gap-1">
                <p className="text-card-foreground text-base font-medium">
                  Profile
                </p>
                <p className="text-muted-foreground text-xs font-normal">
                  The account you’re signed in with.
                </p>
              </div>

              <Separator />

              <FieldGroup className="gap-5">
                <Field className="gap-1.5">
                  <FieldLabel
                    htmlFor="account-email"
                    className="text-muted-foreground text-sm font-normal"
                  >
                    Email
                  </FieldLabel>
                  <Input
                    id="account-email"
                    type="email"
                    value={user?.email ?? ''}
                    readOnly
                    className="dark:bg-background h-9 shadow-xs"
                  />
                  <FieldDescription className="text-xs">
                    Your email is used to sign in and can’t be changed yet.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        {/* ---------------------------- Session ---------------------------- */}
        <div className="col-span-12 xl:col-span-5">
          <Card className="ring-0 border rounded-2xl">
            <CardContent className="flex h-full flex-col gap-6 p-6">
              <div className="flex items-center gap-3">
                <span className="bg-muted/60 text-card-foreground flex size-9 items-center justify-center rounded-xl">
                  <ShieldCheck size={16} />
                </span>
                <div className="flex flex-col">
                  <p className="text-card-foreground text-base font-medium">
                    Session
                  </p>
                  <p className="text-muted-foreground text-xs font-normal">
                    You’re signed in on this device.
                  </p>
                </div>
              </div>

              <Separator />

              <Button
                onClick={() => void logout()}
                variant="outline"
                size="lg"
                className="mt-auto h-10 gap-1.5 rounded-lg"
              >
                <LogOut size={16} />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ------------------------- Mock / examples ------------------------- */}
      <ExampleSection
        title="Preferences"
        description="Placeholder controls modelled on the forms-01 layout — not wired to the backend yet."
      >
        <Card className="ring-0 border rounded-2xl">
          <CardContent className="flex flex-col gap-6 p-6">
            <FieldGroup className="gap-5">
              <Field orientation="horizontal" className="items-start gap-3">
                <Checkbox id="pref-digest" defaultChecked disabled />
                <div className="flex flex-col gap-1">
                  <FieldLabel
                    htmlFor="pref-digest"
                    className="text-card-foreground text-sm font-medium"
                  >
                    Daily digest email
                  </FieldLabel>
                  <FieldDescription className="text-xs">
                    Receive a summary of new articles each morning.
                  </FieldDescription>
                </div>
              </Field>
              <Separator />
              <Field orientation="horizontal" className="items-start gap-3">
                <Checkbox id="pref-breaking" disabled />
                <div className="flex flex-col gap-1">
                  <FieldLabel
                    htmlFor="pref-breaking"
                    className="text-card-foreground text-sm font-medium"
                  >
                    Breaking-news alerts
                  </FieldLabel>
                  <FieldDescription className="text-xs">
                    Push a notification when a tracked entity spikes.
                  </FieldDescription>
                </div>
              </Field>
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="h-9 rounded-lg"
              >
                Cancel
              </Button>
              <Button size="sm" disabled className="h-9 rounded-lg">
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </ExampleSection>
    </PageBody>
  );
}
