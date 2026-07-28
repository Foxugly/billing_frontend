import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { environment } from '../../../../environments/environment';

/** Runtime version injected via SSM (window.__FOO_VERSION), else build-time. */
function resolveVersion(): string {
  const injected =
    typeof window !== 'undefined'
      ? (window as unknown as { __FOO_VERSION?: string }).__FOO_VERSION
      : undefined;
  return injected || environment.appVersion;
}

/**
 * Fleet-standard footer (STANDARD-frontend-layout.md §Footer): brand · tagline ·
 * spacer · «Version {x}» · © year Foxugly (logo → foxugly.com) · Privacy · rights,
 * `·` separators, full-width surface, dark-mode aware.
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly version = resolveVersion();
  readonly year = new Date().getFullYear();
}
