import '../styles/document.scss';
import { Index } from "flexsearch";

console.log('document page');

/**
 * FlexSearch v0.7.x example
 */
const index = new Index();

const document = [
  { id: `threecat`, body: `cat meows. cat stretch. cat sleep.` },
  { id: `onecat`, body: `cat is still asleep` },
  { id: `catcatdogdog`, body: `dog barks at cat. cat runs from dog.` },
  { id: `onedog`, body: `dog sleeps` },
  { id: `threedog`, body: `dog woofs. dog chases tail. dog sleeps` }
];
document.forEach(({ id, body }) => {
  index.add(id, body);
});

console.log(index);

console.log(index.search("cat meows"));
