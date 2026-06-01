import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-about-me',
  standalone: true,
  imports: [],
  templateUrl: './about-me.html',
  styleUrl: './about-me.css',
})
export class AboutMe implements OnInit {
  userData = signal<any>(null);

  ngOnInit() {
    this.getGitHubProfile();
  }

  async getGitHubProfile() {
    try {
      const response = await fetch('https://api.github.com/users/sozarg');
      if (response.ok) {
        const data = await response.json();
        this.userData.set(data);
      }
    } catch (error) {
      console.error('Error al traer datos de GitHub', error);
    }
  }
}
