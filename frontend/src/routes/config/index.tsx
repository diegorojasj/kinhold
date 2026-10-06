import { useNavigate } from '@solidjs/router';
import { type Component, createSignal, Show } from 'solid-js';
import { Icon } from '@/components/Icon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PageHeader } from '@/components/PageHeader';
import { Card, Row } from '@/components/settings';
import { createSheet, Sheet } from '@/components/Sheet';
import { Avatar, Segmented, Toggle } from '@/components/ui';
import { t } from '@/i18n';
import { haptic } from '@/lib/feedback';
import { clearPersisted } from '@/lib/persist';
import { platform } from '@/lib/platform';
import { household, ME, me } from '@/stores/household';
import { prefs, type ThemePref } from '@/stores/prefs';
import { toast } from '@/stores/toast';
import { ProfileForm } from './ProfileForm';

/** System settings: you and this device. Household settings live on their own screen (/household). */
const Config: Component = () => {
  const navigate = useNavigate();
  const profile = createSheet<true>();
  const [confirmReset, setConfirmReset] = createSignal(false);

  const setTheme = (theme: ThemePref) =>
    prefs.update((p) => {
      p.theme = theme;
    });
  const setSounds = (on: boolean) =>
    prefs.update((p) => {
      p.sounds = on;
    });
  const setHaptics = (on: boolean) =>
    prefs.update((p) => {
      p.haptics = on;
    });

  const setNotifications = async (on: boolean) => {
    if (!on) {
      prefs.update((p) => {
        p.notifications = false;
      });
      return;
    }
    if (!('Notification' in window)) {
      toast({ emoji: '🔕', message: t('config.notificationsUnsupported') });
      return;
    }
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      toast({ emoji: '🔕', message: t('config.notificationsDenied') });
      return;
    }
    prefs.update((p) => {
      p.notifications = true;
    });
    toast({ emoji: '🔔', message: t('config.notificationsOn') });
  };

  const reset = () => {
    if (!confirmReset()) {
      setConfirmReset(true);
      haptic('warn');
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    clearPersisted();
    location.reload();
  };

  return (
    <>
      <PageHeader title={t('config.title')} />

      {/* You */}
      <button type="button" class="card flex w-full animate-rise items-center gap-4 p-5 text-left" onClick={() => profile.show(true)}>
        <Avatar id={ME} size="lg" />
        <span class="min-w-0 flex-1">
          <span class="block font-display text-xl font-bold">{me()?.name}</span>
          <span class="text-sm text-ink-soft">{t('config.profile')}</span>
        </span>
        <span class="icon-btn bg-sunk">
          <Icon name="pencil" class="size-5" />
        </span>
      </button>

      {/* Way out to the household screen (the only household entry point on phones besides the header chip). */}
      <Card title={t('household.household')}>
        <Row
          icon="users"
          label={t('config.householdLink')}
          hint={t('config.householdLinkHint', { name: household().name })}
          onClick={() => navigate('/household')}
        />
      </Card>

      {/* Preferences (this device only) */}
      <Card title={t('config.preferences')}>
        <div class="py-3">
          <span class="label">{t('config.theme')}</span>
          <Segmented<ThemePref>
            label={t('config.theme')}
            value={prefs.state.theme}
            options={[
              { value: 'system', label: t('config.themeSystem') },
              { value: 'light', label: t('config.themeLight') },
              { value: 'dark', label: t('config.themeDark') },
            ]}
            onChange={setTheme}
          />
        </div>
        <div class="border-t border-line py-4">
          <LanguageSwitcher />
        </div>
        <div class="divide-y divide-line border-t border-line">
          <Toggle
            label={t('config.notifications')}
            hint={t('config.notificationsHint')}
            checked={prefs.state.notifications}
            onChange={(v) => void setNotifications(v)}
          />
          <Toggle label={t('config.sounds')} hint={t('config.soundsHint')} checked={prefs.state.sounds} onChange={setSounds} />
          <Toggle label={t('config.haptics')} hint={t('config.hapticsHint')} checked={prefs.state.haptics} onChange={setHaptics} />
        </div>
      </Card>

      {/* This device */}
      <Card title={t('config.thisDevice')}>
        <Row
          icon="trash"
          label={confirmReset() ? t('common.tapToConfirm') : t('config.reset')}
          hint={t('config.resetHint')}
          onClick={reset}
        />
      </Card>

      <p class="mt-6 text-center text-sm text-ink-faint">{t('config.platform', { platform })}</p>

      <Sheet open={profile.open()} onClose={profile.close} title={t('config.profile')}>
        <Show when={profile.value()}>
          <ProfileForm onDone={profile.close} />
        </Show>
      </Sheet>
    </>
  );
};

export default Config;
